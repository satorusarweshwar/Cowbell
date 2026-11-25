import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Dices, Download, Minus, Play, Plus, Save, Square, Trash2 } from "lucide-react";
import { engine, snapshotFrom } from "@/lib/phonk/engine";
import { clonePattern, PRESETS, rollPattern, type Preset } from "@/lib/phonk/patterns";
import { loadSession, loadTape, saveSession, saveTape, type SessionBlob } from "@/lib/phonk/storage";
import { degreeName, KEYS, keyById, PENTA } from "@/lib/phonk/theory";
import { DRUM_IDS, DRUM_LABELS, STEPS, type DrumId, type Pattern, type TapeSlot, type VoiceId } from "@/lib/phonk/types";
import { downloadBlob } from "@/lib/phonk/wav";

const initial = PRESETS[0]!;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "loop";
}

export function Studio() {
  const [pattern, setPattern] = useState<Pattern>(() => clonePattern(initial.pattern));
  const [origin, setOrigin] = useState<string | null>(initial.id);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [brush, setBrush] = useState<number | "erase">(0);
  const [tape, setTape] = useState<TapeSlot[]>([]);
  const [ready, setReady] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [bounceError, setBounceError] = useState("");
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setPattern(session.pattern);
      setOrigin(session.origin);
    }
    setTape(loadTape());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const blob: SessionBlob = { pattern, origin };
    const id = window.setTimeout(() => saveSession(blob), 280);
    return () => window.clearTimeout(id);
  }, [pattern, origin, ready]);

  useEffect(() => {
    engine.sync(snapshotFrom(pattern));
  }, [pattern]);

  useEffect(() => {
    engine.onStep = (value) => setStep(value);
    return () => {
      engine.onStep = () => {};
      engine.stop();
    };
  }, []);

  const toggle = useCallback(async () => {
    engine.sync(snapshotFrom(patternRef.current));
    const next = await engine.toggle();
    setPlaying(next);
    if (!next) setStep(-1);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.code !== "Space") return;
      event.preventDefault();
      void toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  function loadPreset(preset: Preset) {
    setPattern(clonePattern(preset.pattern));
    setOrigin(preset.id);
  }

  function cycleDrum(id: DrumId, index: number) {
    setPattern((current) => {
      const row = current.drums[id].slice();
      const cell = row[index] ?? 0;
      row[index] = cell === 0 ? 0.42 : cell < 0.75 ? 1 : 0;
      return { ...current, drums: { ...current.drums, [id]: row } };
    });
  }

  function paint(lane: "bass" | "lead", index: number) {
    setPattern((current) => {
      const row = current[lane].slice();
      if (brush === "erase") row[index] = null;
      else row[index] = row[index] === brush ? null : brush;
      return { ...current, [lane]: row };
    });
  }

  function toggleMute(id: VoiceId) {
    setPattern((current) => ({
      ...current,
      mix: { ...current.mix, mutes: { ...current.mix.mutes, [id]: !current.mix.mutes[id] } },
    }));
  }

  function setVolume(id: VoiceId, value: number) {
    setPattern((current) => ({
      ...current,
      mix: { ...current.mix, volumes: { ...current.mix.volumes, [id]: value } },
    }));
  }

  function setField<K extends "drive" | "cutoff" | "room" | "tape">(key: K, value: number) {
    setPattern((current) => ({ ...current, mix: { ...current.mix, [key]: value } }));
  }

  function stash() {
    const slot: TapeSlot = {
      id: crypto.randomUUID(),
      savedAt: Date.now(),
      pattern: clonePattern(pattern),
    };
    const next = [slot, ...tape].slice(0, 16);
    setTape(next);
    saveTape(next);
  }

  async function bounce() {
    setBouncing(true);
    setBounceError("");
    try {
      const blob = await engine.bounce(patternRef.current, 4);
      downloadBlob(blob, `cowbell-${slug(patternRef.current.name)}.wav`);
    } catch {
      setBounceError("Couldn't bounce that loop. Hit play once, then try again.");
    } finally {
      setBouncing(false);
    }
  }

  const root = keyById(pattern.keyId).root;

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={clsx("h-2.5 w-2.5 rounded-full bg-primary", playing && "pulse-led")} aria-hidden="true" />
            <div>
              <h1 className="font-display text-4xl leading-none tracking-wide">COWBELL</h1>
              <p className="text-xs uppercase tracking-widest text-muted">Phonk machine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggle()}
              aria-pressed={playing}
              className="glow inline-flex h-12 items-center gap-2 rounded-md bg-primary px-4 font-display text-lg tracking-wide text-bg"
            >
              {playing ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
              {playing ? "Stop" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => void bounce()}
              disabled={bouncing}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-fg disabled:opacity-50"
            >
              <Download className="size-4" />
              {bouncing ? "Bouncing" : "Bounce"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        <p className="max-w-xl text-sm text-muted">
          Sequence a one-bar phonk loop — cowbell, 808s, swung hats — then bounce four bars to WAV. Nothing leaves this browser.
        </p>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-40 flex-1 flex-col gap-1">
              <span className="text-xs uppercase tracking-widest text-muted">Loop</span>
              <input
                aria-label="Loop name"
                value={pattern.name}
                maxLength={32}
                onChange={(event) => setPattern({ ...pattern, name: event.target.value })}
                className="h-11 rounded-md border border-border bg-bg px-3 font-display text-xl tracking-wide text-fg"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Slower"
                onClick={() => setPattern({ ...pattern, bpm: clamp(pattern.bpm - 1, 70, 190) })}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-bg text-fg"
              >
                <Minus className="size-4" />
              </button>
              <label className="flex w-16 flex-col items-center">
                <span className="text-xs uppercase tracking-widest text-muted">BPM</span>
                <input
                  aria-label="Tempo"
                  type="number"
                  min={70}
                  max={190}
                  value={pattern.bpm}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    setPattern({ ...pattern, bpm: clamp(Math.round(next), 70, 190) });
                  }}
                  className="w-full bg-transparent text-center font-display text-3xl leading-none tabular-nums text-fg"
                />
              </label>
              <button
                type="button"
                aria-label="Faster"
                onClick={() => setPattern({ ...pattern, bpm: clamp(pattern.bpm + 1, 70, 190) })}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-bg text-fg"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <label className="flex min-w-40 flex-1 flex-col gap-1">
              <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted">
                Swing
                <span className="tabular-nums">{Math.round(pattern.swing * 100)}</span>
              </span>
              <input
                aria-label="Swing"
                type="range"
                min={0}
                max={0.6}
                step={0.01}
                value={pattern.swing}
                onChange={(event) => setPattern({ ...pattern, swing: Number(event.target.value) })}
                className="h-11 w-full"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted">Key</span>
            {KEYS.map((key) => (
              <button
                key={key.id}
                type="button"
                aria-pressed={pattern.keyId === key.id}
                onClick={() => setPattern({ ...pattern, keyId: key.id })}
                className={clsx(
                  "h-11 rounded-md border px-3 text-sm font-semibold",
                  pattern.keyId === key.id ? "border-primary text-primary" : "border-border bg-bg text-fg",
                )}
              >
                {key.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={origin === preset.id}
                onClick={() => loadPreset(preset)}
                className={clsx(
                  "h-11 shrink-0 rounded-md border px-3 text-sm font-semibold",
                  origin === preset.id ? "border-primary text-primary" : "border-border bg-bg text-fg",
                )}
              >
                {preset.pattern.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPattern(rollPattern());
                setOrigin(null);
              }}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-border bg-bg px-3 text-sm font-semibold text-fg"
            >
              <Dices className="size-4" />
              Roll
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-3">
          <div className="overflow-x-auto">
            <div className="flex w-max min-w-full flex-col gap-1">
              <div className="flex items-end gap-1" aria-hidden="true">
                <div className="sticky left-0 z-10 h-16 w-24 shrink-0 bg-surface" />
                {Array.from({ length: STEPS }, (_, index) => (
                  <span
                    key={index}
                    className={clsx("w-11 shrink-0 rounded-sm", stepGap(index), step === index ? "bg-primary" : "bg-muted/40")}
                    style={{ height: `${Math.round(8 + stepEnergy(pattern, index) * 56)}px` }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <div className="sticky left-0 z-10 w-24 shrink-0 bg-surface text-xs uppercase tracking-widest text-muted">Trk</div>
                {Array.from({ length: STEPS }, (_, index) => (
                  <span
                    key={index}
                    data-playhead={step === index ? "on" : "off"}
                    className={clsx(
                      "w-11 shrink-0 text-center text-xs tabular-nums",
                      stepGap(index),
                      step === index ? "font-semibold text-primary" : index % 4 === 0 ? "text-fg" : "text-muted",
                    )}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
              {DRUM_IDS.map((id) => (
                <DrumRow
                  key={id}
                  id={id}
                  pattern={pattern}
                  step={step}
                  onCycle={cycleDrum}
                  onMute={toggleMute}
                />
              ))}
              <PitchRow lane="bass" label="BASS" name="Bass" pattern={pattern} step={step} root={root} onPaint={paint} onMute={toggleMute} />
              <PitchRow lane="lead" label="LEAD" name="Lead" pattern={pattern} step={step} root={root} onPaint={paint} onMute={toggleMute} />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">Drum steps cycle ghost, accent, off. Space plays.</p>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          <h2 className="font-display text-lg tracking-wide">Paint</h2>
          <div className="flex flex-wrap items-center gap-2">
            {PENTA.map((_, degree) => (
              <button
                key={degree}
                type="button"
                aria-pressed={brush === degree}
                onClick={() => setBrush(degree)}
                className={clsx(
                  "h-11 min-w-11 rounded-md border px-3 text-sm font-semibold",
                  brush === degree ? "border-primary text-primary" : "border-border bg-bg text-fg",
                )}
              >
                {degreeName(root, degree)}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={brush === "erase"}
              onClick={() => setBrush("erase")}
              className={clsx(
                "h-11 rounded-md border px-3 text-sm font-semibold",
                brush === "erase" ? "border-primary text-primary" : "border-border bg-bg text-fg",
              )}
            >
              Erase
            </button>
          </div>
          <p className="text-sm text-muted">Pick a scale tone, then tap bass or lead steps. Tap a written note again to clear it.</p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-3 font-display text-lg tracking-wide">Mix</h2>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {([...DRUM_IDS, "bass", "lead"] as VoiceId[]).map((id) => (
              <Slider
                key={id}
                label={id === "bass" || id === "lead" ? (id === "bass" ? "Bass" : "Lead") : DRUM_LABELS[id].short}
                value={pattern.mix.volumes[id]}
                onChange={(value) => setVolume(id, value)}
              />
            ))}
            <Slider label="Drive" value={pattern.mix.drive} onChange={(value) => setField("drive", value)} />
            <Slider label="Filter" value={pattern.mix.cutoff} onChange={(value) => setField("cutoff", value)} />
            <Slider label="Room" value={pattern.mix.room} onChange={(value) => setField("room", value)} />
            <Slider label="Tape" value={pattern.mix.tape} onChange={(value) => setField("tape", value)} />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg tracking-wide">Tape</h2>
            <button
              type="button"
              onClick={stash}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-3 text-sm font-semibold text-fg"
            >
              <Save className="size-4" />
              Save loop
            </button>
          </div>
          {tape.length === 0 ? (
            <p className="text-sm text-muted">No stashed loops yet. Save this one to the tape — it stays on this device.</p>
          ) : (
            <ul className="flex flex-col">
              {tape.map((slot) => (
                <li key={slot.id} className="flex items-center gap-2 border-t border-border py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPattern(clonePattern(slot.pattern));
                      setOrigin(null);
                    }}
                    className="flex h-11 flex-1 items-center justify-between gap-3 px-1 text-left"
                  >
                    <span className="font-medium">{slot.pattern.name}</span>
                    <span className="text-sm tabular-nums text-muted">{slot.pattern.bpm} bpm</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${slot.pattern.name}`}
                    onClick={() => {
                      const next = tape.filter((item) => item.id !== slot.id);
                      setTape(next);
                      saveTape(next);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {bounceError ? <p className="mt-2 text-sm text-primary">{bounceError}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 min-w-0 flex-1"
      />
      <span className="w-8 text-right text-xs tabular-nums text-muted">{Math.round(value * 100)}</span>
    </label>
  );
}

function DrumRow({
  id,
  pattern,
  step,
  onCycle,
  onMute,
}: {
  id: DrumId;
  pattern: Pattern;
  step: number;
  onCycle: (id: DrumId, index: number) => void;
  onMute: (id: VoiceId) => void;
}) {
  const meta = DRUM_LABELS[id];
  const muted = pattern.mix.mutes[id];
  return (
    <div className={clsx("flex items-center gap-1", muted && "opacity-40")}>
      <div
        className={clsx(
          "sticky left-0 z-10 flex w-24 shrink-0 items-center gap-1 bg-surface pr-1",
          id === "cowbell" && "border-l-2 border-l-primary pl-1",
        )}
      >
        <button
          type="button"
          aria-pressed={muted}
          aria-label={`Mute ${meta.name}`}
          onClick={() => onMute(id)}
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border text-xs font-bold",
            muted ? "border-primary bg-primary text-bg" : "border-border bg-bg text-muted",
          )}
        >
          M
        </button>
        <span className="text-xs font-semibold tracking-wide">{meta.short}</span>
      </div>
      {pattern.drums[id].map((vel, index) => {
        const accent = vel >= 0.75;
        const ghost = vel > 0 && !accent;
        const beat = index % 2 === 0;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={vel > 0}
            aria-label={`${meta.name} step ${index + 1}`}
            onClick={() => onCycle(id, index)}
            className={clsx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border",
              stepGap(index),
              accent ? "border-primary bg-primary led-hot" : ghost ? "border-primary bg-surface-2" : beat ? "border-border bg-surface-2" : "border-border bg-bg",
              step === index && "ring-2 ring-fg",
            )}
          >
            {ghost ? <span className="h-3 w-3 rounded-sm bg-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function PitchRow({
  lane,
  label,
  name,
  pattern,
  step,
  root,
  onPaint,
  onMute,
}: {
  lane: "bass" | "lead";
  label: string;
  name: string;
  pattern: Pattern;
  step: number;
  root: number;
  onPaint: (lane: "bass" | "lead", index: number) => void;
  onMute: (id: VoiceId) => void;
}) {
  const muted = pattern.mix.mutes[lane];
  return (
    <div className={clsx("flex items-center gap-1", muted && "opacity-40")}>
      <div className="sticky left-0 z-10 flex w-24 shrink-0 items-center gap-1 bg-surface pr-1">
        <button
          type="button"
          aria-pressed={muted}
          aria-label={`Mute ${name}`}
          onClick={() => onMute(lane)}
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border text-xs font-bold",
            muted ? "border-primary bg-primary text-bg" : "border-border bg-bg text-muted",
          )}
        >
          M
        </button>
        <span className="text-xs font-semibold tracking-wide">{label}</span>
      </div>
      {pattern[lane].map((degree, index) => {
        const active = degree !== null;
        const beat = index % 2 === 0;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={active}
            aria-label={`${name} step ${index + 1}`}
            onClick={() => onPaint(lane, index)}
            className={clsx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border font-semibold",
              stepGap(index),
              active ? "border-primary bg-primary text-bg led-hot" : beat ? "border-border bg-surface-2 text-muted" : "border-border bg-bg text-muted",
              step === index && "ring-2 ring-fg",
            )}
          >
            <span className="text-xs">{degree !== null ? degreeName(root, degree) : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

function stepGap(index: number) {
  return index % 4 === 0 && index !== 0 ? "ml-1.5" : undefined;
}

function stepEnergy(pattern: Pattern, index: number) {
  let energy = 0;
  energy += (pattern.drums.kick[index] ?? 0) * 1;
  energy += (pattern.drums.snare[index] ?? 0) * 0.7;
  energy += (pattern.drums.clap[index] ?? 0) * 0.45;
  energy += (pattern.drums.cowbell[index] ?? 0) * 0.9;
  energy += (pattern.drums.hat[index] ?? 0) * 0.25;
  energy += pattern.bass[index] !== null ? 0.55 : 0;
  energy += pattern.lead[index] !== null ? 0.3 : 0;
  return Math.min(1, energy / 2.1);
}

