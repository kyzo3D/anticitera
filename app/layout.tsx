import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import clsx from "clsx";
import "./globals.css";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: "Anticitera | Aura",
	description:
		"A fast, open-source voice assistant powered by Groq, Cartesia, and Vercel.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body
				className={clsx(
					inter.className,
					"py-8 px-6 lg:p-10 text-white bg-black min-h-screen flex flex-col justify-between antialiased select-none"
				)}
			>
				<main className="flex flex-col items-center justify-center grow relative">
					<div className="absolute inset-0 -z-10">
						{/* AudioVisualizer component will be rendered here */}
					</div>
					{children}
				</main>

				<Toaster richColors theme="dark" />
				<Analytics />
			</body>
		</html>
	);
}
