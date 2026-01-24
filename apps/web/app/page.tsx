import { Button } from "@workspace/ui/components/button"
import { ArrowRightIcon, GithubIcon, UsersIcon, ZapIcon } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight">Flowpocus</h1>
          <a
            href="https://github.com/user/flowpocus"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <GithubIcon className="size-5" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Real-time Collaborative Canvas
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            An open-source flowchart and diagramming tool built with React Flow, Yjs CRDT, and
            WebSocket. Experience seamless real-time collaboration.
          </p>

          <div className="mt-10">
            <Button asChild size="lg" className="text-base">
              <Link href="/canvas">
                Try it now
                <ArrowRightIcon className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<UsersIcon className="size-6" />}
            title="Real-time Collaboration"
            description="Multiple users can edit the same canvas simultaneously with live cursor tracking and instant sync."
          />
          <FeatureCard
            icon={<ZapIcon className="size-6" />}
            title="CRDT-powered"
            description="Built on Yjs CRDT for conflict-free merging. Works offline and syncs when reconnected."
          />
          <FeatureCard
            icon={<GithubIcon className="size-6" />}
            title="Open Source"
            description="Fully open-source under MIT license. Fork it, extend it, make it your own."
          />
        </div>

        {/* Tech Stack */}
        <div className="mt-24 text-center">
          <h3 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Built with</h3>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-zinc-600 dark:text-zinc-400">
            <span>React Flow</span>
            <span>Yjs</span>
            <span>WebSocket</span>
            <span>Next.js</span>
            <span>Hono</span>
            <span>Drizzle</span>
            <span>SQLite</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-zinc-500">
          Open source project for demonstration purposes
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 inline-flex rounded-lg bg-zinc-100 p-3 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  )
}
