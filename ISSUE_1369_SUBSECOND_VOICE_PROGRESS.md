# Issue 1369: Sub-second Voice Progress

## Summary

The voice message flow now keeps fractional seconds instead of flooring every duration and playback position to whole seconds. This makes very short voice messages show useful progress, for example `00:00.4 / 00:00.8`, instead of looking like `0:00 / 0:00`.

The change affects three parts of the flow:

- Recording timers update every 100ms and store the actual fractional recording duration.
- Voice message rendering formats current and total time with one decimal place.
- Playback and seek controls preserve fractional `currentTime`, `duration`, and slider values.

## New Timer Format

All voice timers now use this display shape:

```text
mm:ss.t
```

Examples:

| Input seconds | Rounded tenths | Display |
| ---: | ---: | --- |
| `0` | `0` | `00:00.0` |
| `0.04` | `0` | `00:00.0` |
| `0.05` | `1` | `00:00.1` |
| `0.84` | `8` | `00:00.8` |
| `1.26` | `13` | `00:01.3` |
| `61.24` | `612` | `01:01.2` |
| `299.96` | `3000` | `05:00.0` |

## Functions Added

| Function | Location | Purpose | Key behavior |
| --- | --- | --- | --- |
| `formatVoiceTimer(seconds)` | top-level helper in `app.js` | Converts seconds to `mm:ss.t`. | Coerces to `Number`, rejects non-positive or non-finite values as `00:00.0`, rounds to nearest tenth. |
| `getPositiveDurationSeconds(seconds)` | `ChatModal` | Normalizes duration inputs used by voice message UI. | Returns the positive finite number or `0`. |
| `formatVoiceProgressTime(seconds, totalSeconds)` | `ChatModal` | Formats the current playback or seek position. | Clamps current time to `0`; if a total exists, caps current at total before formatting. |

## Math

`formatVoiceTimer(seconds)` converts seconds into tenths first, then derives minutes, seconds, and the tenths digit from that integer.

```js
const totalTenths = Math.round(duration * 10);
const mins = Math.floor(totalTenths / 600);
const secs = Math.floor((totalTenths % 600) / 10);
const tenths = totalTenths % 10;
```

Why `600`?

- There are `60` seconds in a minute.
- There are `10` tenths in each second.
- `60 * 10 = 600` tenths per minute.

Example for `61.24` seconds:

| Step | Calculation | Result |
| --- | --- | ---: |
| Convert to tenths | `Math.round(61.24 * 10)` | `612` |
| Minutes | `Math.floor(612 / 600)` | `1` |
| Remaining tenths | `612 % 600` | `12` |
| Seconds | `Math.floor(12 / 10)` | `1` |
| Tenths digit | `12 % 10` | `2` |
| Display | `01:01.2` | |

## Recording Flow

```mermaid
flowchart TD
  A[User starts voice recording] --> B[MediaRecorder starts]
  B --> C[recordingStartTime = Date.now()]
  C --> D[startRecordingTimer()]
  D --> E[Every 100ms, compute elapsed / 1000]
  E --> F[formatVoiceTimer(seconds)]
  F --> G[Update recording timer label]
  E --> H{Elapsed >= 5 minutes?}
  H -- No --> E
  H -- Yes --> I[stopVoiceRecording()]
  I --> J[recordingStopTime = Date.now()]
  J --> K[actualDuration = stop - start, in seconds]
  K --> L[Show final fractional duration]
```

### Recording Changes

| Before | After | Why it matters |
| --- | --- | --- |
| Timer updated every `1000ms`. | Timer updates every `100ms`. | The user sees immediate movement for short recordings. |
| Duration used `Math.floor(...)`. | Duration stores `(stop - start) / 1000`. | Sub-second recordings keep their real length. |
| Display used `00:00` or whole seconds. | Display uses `00:00.0`. | Short clips no longer appear to have zero duration. |

## Send Flow

```mermaid
flowchart TD
  A[User taps send] --> B[getRecordingDuration()]
  B --> C[Return actualDuration with fractional seconds]
  C --> D[sendVoiceMessageTx(url, duration, keys)]
  D --> E[Message object stores duration]
  E --> F[Optimistic local message stores same duration]
  F --> G[Chat re-renders voice message bubble]
```

The sent message now carries fractional `duration`, so the first render after sending can show the exact recorded duration without waiting for audio metadata.

## Render Flow

```mermaid
flowchart TD
  A[Render message with type vm] --> B[getPositiveDurationSeconds(item.duration)]
  B --> C[formatVoiceProgressTime(0, duration)]
  B --> D[formatVoiceTimer(duration)]
  C --> E[Render current time]
  D --> F[Render total time]
  B --> G[Set range max to fractional duration]
  G --> H[Set range step to 0.01]
```

### Rendered Voice Message Values

| Field | Source | New value behavior |
| --- | --- | --- |
| `data-duration` | normalized `item.duration` | Preserves positive fractional seconds. |
| `.voice-message-time-display` | current + total formatter | Starts at `00:00.0 / mm:ss.t`. |
| `.voice-message-seek max` | normalized duration | Allows fractional max values. |
| `.voice-message-seek step` | literal `0.01` | Allows hundredth-second seek increments. |

## Playback Flow

```mermaid
flowchart TD
  A[User taps play] --> B[Decrypt audio and create Audio object]
  B --> C[Read message.duration]
  C --> D[updateDurationUi()]
  D --> E[Set slider max and time label]
  B --> F[loadedmetadata event]
  F --> G{Stored duration missing?}
  G -- Yes --> H[Use audio.duration from metadata]
  H --> D
  G -- No --> I[Keep stored duration]
  F --> J{Pending seek exists?}
  J -- Yes --> K[Apply pending currentTime]
  J -- No --> L[Start normal playback]
  K --> L
  L --> M[ontimeupdate]
  M --> N[Set slider value = audio.currentTime]
  M --> O[Format current and total time]
```

### Playback Changes

| Before | After | Why it matters |
| --- | --- | --- |
| `audio.currentTime` was floored before updating the slider. | Slider receives the fractional `audio.currentTime`. | Progress moves smoothly for short clips. |
| Total duration was floored from `message.duration`. | Total duration keeps positive fractional seconds. | Total time matches the recorded duration. |
| Missing duration stayed `0`. | Metadata can fill `totalDurationSeconds` from `audio.duration`. | Older or incomplete messages can still show a useful total after load. |
| Resume seek tolerance was `0.25s`. | Resume seek tolerance is `0.01s`. | Resume honors fine-grained slider positions. |

## Seek Flow

```mermaid
flowchart TD
  A[User drags seek slider] --> B[input/change event]
  B --> C[updateVmTimeFromSeek()]
  C --> D[Read fractional seek value]
  D --> E[Read total from slider max or data-duration]
  E --> F[format current and total labels]
  F --> G[Store pendingSeekTime]
  G --> H{Audio metadata loaded?}
  H -- No --> I[Apply pending seek on loadedmetadata]
  H -- Yes --> J[Playback listener applies currentTime on scrub or commit]
```

### Seek Rules

| Rule | Behavior |
| --- | --- |
| Current display is never negative. | `formatVoiceProgressTime` clamps current time with `Math.max(0, value)`. |
| Current display does not exceed total when total is known. | `formatVoiceProgressTime` uses `Math.min(current, total)`. |
| Seeking before playback is preserved. | `pendingSeekTime` stores the chosen value until metadata is available. |
| Live slider updates are throttled. | Seek input applies at roughly 20fps through the existing 50ms throttle. |

## End-to-End Result

| Scenario | Previous behavior | New behavior |
| --- | --- | --- |
| Record a `0.8s` voice message. | Timer could show `00:00`; sent duration was `0`. | Timer and message show around `00:00.8`. |
| Play a short voice message. | Progress label stayed at `0:00 / 0:00` or barely moved. | Progress advances in tenths of a second. |
| Drag the seek bar on a short message. | Slider only had whole-second precision. | Slider accepts fine-grained positions. |
| Message lacks stored duration. | UI total could remain zero. | Audio metadata can populate the duration after load. |

