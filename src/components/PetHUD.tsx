
import { useState } from "react";

import type {
  PetAction,
  PetState,
  Temperament,
  TimeMode,
} from "../lib/pet";

import "./PetHUD.css";

type Props = {
  pet: PetState;
  onAction: (a: PetAction) => void;
  onTemperament: (t: Temperament) => void;
  timeMode: TimeMode;
  onTimeMode: (t: TimeMode) => void;
  actualTime: string;
  muted: boolean;
  onMute: () => void;
  lampOn: boolean;
  onLamp: () => void;
  stoolLampOn: boolean;
  onStoolLamp: () => void;
  blindsOpen: boolean;
  onBlinds: () => void;
  onMusicFile?: () => void;
};

const actionIcons = [
  {
    action: "feed",
    icon: "/icons/icon-feed.png",
    label: "Feed Mochi",
  },
  {
    action: "pet",
    icon: "/icons/icon-love.png",
    label: "Pet Mochi",
  },
  {
    action: "play",
    icon: "/icons/icon-play.png",
    label: "Play with Mochi",
  },
  {
    action: "sleep",
    icon: "/icons/icon-sleep.png",
    label: "Sleep / Wake Mochi",
  },
] as const;

export default function PetHUD({
  pet,
  onAction,
  onTemperament,
  timeMode,
  onTimeMode,
  actualTime,
  muted,
  onMute,
  lampOn,
  onLamp,
  stoolLampOn,
  onStoolLamp,
  blindsOpen,
  onBlinds,
}: Props) {
  const [settings, setSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hint, setHint] = useState(true);

  const stats = [
    ["Happiness", pet.stats.happiness, "#e7a2a7"],
    ["Fullness", pet.stats.hunger, "#d8b47c"],
    ["Energy", pet.stats.energy, "#a4b4db"],
    ["Wellness", pet.stats.wellness, "#a2bca1"],
  ] as const;

  return (
    <div className="pet-hud">

      {/* TOP LEFT - TIME */}

      <div className="hud-top-left hud-panel">
        <span>{actualTime}</span>

        <span className="hud-sub">
          {timeMode === "auto"
            ? "Real-time room"
            : `${timeMode} mode`}
        </span>
      </div>

      {/* TOP RIGHT - VOLUME & SETTINGS */}

      <div className="hud-top-right">
        <button
          className="hud-icon-btn"
          type="button"
          title={muted ? "Unmute music" : "Mute music"}
          aria-label={muted ? "Unmute music" : "Mute music"}
          aria-pressed={muted}
          onClick={onMute}
        >
          <img
            className={`hud-icon hud-icon-volume ${
              muted ? "hud-icon-muted" : ""
            }`}
            src="/icons/icon-volume.png"
            alt=""
            draggable={false}
          />
        </button>

        <button
          className="hud-icon-btn"
          type="button"
          title="Settings"
          aria-label="Settings"
          aria-expanded={settings}
          onClick={() => setSettings((v) => !v)}
        >
          <img
            className="hud-icon hud-icon-settings"
            src="/icons/icon-settings.png"
            alt=""
            draggable={false}
          />
        </button>
      </div>

      {/* INTERACTION HINT */}

      {hint && (
        <button
          className="hud-hint"
          type="button"
          onClick={() => setHint(false)}
        >
          Click objects to interact with Mochi
          <span>×</span>
        </button>
      )}

      {/* BOTTOM LEFT - MOCHI STATUS */}

      <div className="hud-bottom-left hud-panel">
        <button
          className="hud-status"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <strong>Mochi</strong>
          <span>{expanded ? "⌄" : "⌃"}</span>
        </button>

        <div className="hud-sub">
          {pet.message}
        </div>

        {expanded && (
          <div className="hud-stats">
            {stats.map(([name, value, color]) => (
              <div key={name}>
                <div className="hud-stat-label">
                  <span>{name}</span>
                  <span>{Math.round(value)}%</span>
                </div>

                <div className="hud-meter">
                  <div
                    style={{
                      width: `${value}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM RIGHT - ACTION ICONS */}

      <div className="hud-actions">
        {actionIcons.map(({ action, icon, label }) => (
          <button
            key={action}
            className="hud-icon-btn"
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onAction(action as PetAction)}
          >
            <img
              className={`hud-icon hud-icon-${action}`}
              src={icon}
              alt=""
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* SETTINGS PANEL */}

      {settings && (
        <div className="hud-settings hud-panel">
          <div className="hud-settings-title">
            <strong>Little room settings</strong>

            <button
              type="button"
              onClick={() => setSettings(false)}
              aria-label="Close settings"
            >
              ×
            </button>
          </div>

          <label>
            Time of day

            <select
              value={timeMode}
              onChange={(e) =>
                onTimeMode(e.target.value as TimeMode)
              }
            >
              {(
                [
                  "auto",
                  "morning",
                  "afternoon",
                  "evening",
                  "night",
                ] as const
              ).map((x) => (
                <option value={x} key={x}>
                  {x[0].toUpperCase() + x.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mochi's temperament

            <select
              value={pet.temperament}
              onChange={(e) =>
                onTemperament(e.target.value as Temperament)
              }
            >
              <option value="gentle">
                Shy & gentle
              </option>

              <option value="playful">
                Playful & curious
              </option>

              <option value="sleepy">
                Sleepy & cuddly
              </option>
            </select>
          </label>

          <button
            className="hud-toggle"
            type="button"
            onClick={onLamp}
          >
            Floor lamp: {lampOn ? "On" : "Off"}
          </button>

          <button
            className="hud-toggle"
            type="button"
            onClick={onStoolLamp}
          >
            Stool lamp: {stoolLampOn ? "On" : "Off"}
          </button>

          <button
            className="hud-toggle"
            type="button"
            onClick={onBlinds}
          >
            Window blinds: {blindsOpen ? "Open" : "Closed"}
          </button>

          <button
            className="hud-toggle"
            type="button"
            onClick={onMute}
          >
            Music: {muted ? "Muted" : "Playing"}
          </button>

          <p className="hud-settings-note">
            Click the lamps or blinds in the 3D room too.
            Music starts after a click and needs an audio file.
          </p>
        </div>
      )}
    </div>
  );
}
