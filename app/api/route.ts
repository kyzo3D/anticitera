import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { ElevenLabsClient, ElevenLabs } from "elevenlabs";

const groq = new Groq();
const elevenLabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });

const schema = zfd.formData({
  input: z.union([zfd.text(), z.any()]),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
});

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vercel-id") || Date.now().toString();
  console.time(`transcribe ${requestId}`);

  const { data, success } = schema.safeParse(await request.formData());
  if (!success) return new Response("Invalid request", { status: 400 });

  const transcript = await getTranscript(data.input);
  if (!transcript) return new Response("Invalid audio", { status: 400 });

  console.timeEnd(`transcribe ${requestId}`);
  console.time(`text completion ${requestId}`);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `- You are Aura, an advanced AI administrative assistant developed by Anticitera, a company specializing in AI development.
        - As a conversational assistant, your responses should be clear, concise, and brief to facilitate a natural dialogue and allow the person you're interacting with to speak and participate actively.
        - Your primary function is to assist with administrative tasks and engage in helpful conversations, including but not limited to:
            * Managing schedules and appointments
            * Organizing and facilitating meetings
            * Creating summaries and reports
            * Handling paperwork and documentation
            * Producing transcriptions
        - You are designed to provide quick, relevant information and support, encouraging a balanced interaction where the user can easily follow up or ask for more details if needed.
        - Always aim to be helpful while keeping your responses short and to the point, allowing the conversation to flow naturally.
        - You have the ability to learn and adapt from a vast array of diverse sources.
        - When you're processing information or thinking, do not verbalize pauses or thinking sounds. Simply provide the response when it's ready.
        - Avoid using filler words or phrases that indicate processing time, such as "let me think," "um," or "give me a moment."
        - Your purpose is to simplify work for individuals who face barriers or difficulties in implementing AI in their professional environments.
        - Respond concisely to user requests, providing only necessary information.
        - If you don't understand a request, ask for clarification.
        - You don't have access to real-time data, so avoid providing current information.
        - You can only respond to user queries and cannot perform actual actions.
        - Respond in natural language without using markdown, emojis, or special formatting.
        - User location is ${location()}.
        - The current time is ${time()}.`,
      },
      ...data.message,
      {
        role: "user",
        content: transcript,
      },
    ],
  });	  

  const response = completion.choices[0].message.content;
  console.timeEnd(`text completion ${requestId}`);

  console.time(`elevenlabs request ${requestId}`);

  try {
    const audioStream = await elevenLabs.textToSpeech.convertAsStream("gD1IexrzCvsXPHUuT0s3", {
      optimize_streaming_latency: ElevenLabs.OptimizeStreamingLatency.Zero,
      output_format: ElevenLabs.OutputFormat.Mp344100128,
      text: response,
	    language_code: "es",
	    model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.7,
    		use_speaker_boost: true,
        style: 0.0,
      }
    });

    console.timeEnd(`elevenlabs request ${requestId}`);
    console.time(`stream ${requestId}`);

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      headers: {
        "X-Transcript": encodeURIComponent(transcript),
        "X-Response": encodeURIComponent(response),
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("ElevenLabs API error:", error);
    return new Response("Voice synthesis failed", { status: 500 });
  }

}function location() {
  const headersList = headers();

  const country = headersList.get("x-vercel-ip-country");
  const region = headersList.get("x-vercel-ip-country-region");
  const city = headersList.get("x-vercel-ip-city");

  if (!country || !region || !city) return "unknown";

  return `${city}, ${region}, ${country}`;
}

function time() {
  return new Date().toLocaleString("en-US", {
    timeZone: headers().get("x-vercel-ip-timezone") || undefined,
  });
}

async function getTranscript(input: string | File) {
  if (typeof input === "string") return input;

  try {
    const { text } = await groq.audio.transcriptions.create({
      file: input,
      model: "whisper-large-v3",
    });

    return text.trim() || null;
  } catch {
    return null; // Empty audio file
  }
}
