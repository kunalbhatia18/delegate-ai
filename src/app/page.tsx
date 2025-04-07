import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 -mt-20">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-6 text-center">DelegateAI</h1>
        <p className="text-xl mb-8 text-center">
          The AI-driven delegation system for startups
        </p>
        <div className="flex justify-center">
          <Link 
            href="/dashboard" 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}