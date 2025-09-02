"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  return (
    <main className="flex min-h-dvh" style={{ background: "#121212" }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Content */}
      <section className="flex-1">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div>
              <h1 className="text-pretty text-lg font-semibold text-white">Settings</h1>
              <p className="text-sm text-white/70">Manage your account and preferences</p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Account */}
          <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
            <CardHeader>
              <CardTitle className="text-white">Account</CardTitle>
              <CardDescription className="text-white/70">Basic profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-white/80">
                    Name
                  </Label>
                  <Input id="name" placeholder="Developer Name" className="text-white placeholder:text-white/40" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-white/80">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="developer@cipherscore.dev"
                    className="text-white placeholder:text-white/40"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Key */}
          <ApiKeyCard />

          {/* Preferences */}
          <PreferencesCard />
        </div>
      </section>
    </main>
  )
}

function ApiKeyCard() {
  return (
    <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardHeader>
        <CardTitle className="text-white">API Key</CardTitle>
        <CardDescription className="text-white/70">Keep your key secret. You can copy or regenerate.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="api-key" className="text-white/80">
              Current key
            </Label>
            <MaskedKey />
          </div>
          <div className="flex gap-2 pt-6 sm:pt-8">
            <CopyKeyButton />
            <Button
              className="rounded-full bg-[#8A2BE2] px-4 text-white shadow-sm transition hover:shadow-[0_0_16px_rgba(138,43,226,0.35)]"
              onClick={() => alert("Regenerate not implemented")}
            >
              Regenerate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* Client bits for interactivity */
function MaskedKey() {
  return (
    <input
      readOnly
      value="cs_live_********************************"
      aria-label="API key (masked)"
      className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm text-white"
      style={{ borderColor: "rgba(255,255,255,0.16)" }}
    />
  )
}

function CopyKeyButton() {
  return (
    <button
      type="button"
      aria-label="Copy API key"
      className="rounded-full px-4 text-sm font-medium transition"
      style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent", height: "36px" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText("cs_live_********************************")
          // no toast to keep it minimal
        } catch {
          // ignore
        }
      }}
    >
      Copy
    </button>
  )
}

function PreferencesCard() {
  return (
    <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardHeader>
        <CardTitle className="text-white">Preferences</CardTitle>
        <CardDescription className="text-white/70">Customize notifications and behavior</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
          style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium text-white">Email alerts</p>
            <p className="text-xs text-white/60">Receive usage alerts and updates</p>
          </div>
          <ClientSwitch />
        </div>
      </CardContent>
    </Card>
  )
}
function ClientSwitch() {
  const [enabled, setEnabled] = useState(true)
  return <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Toggle email alerts" />
}
