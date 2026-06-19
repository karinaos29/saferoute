<div align="center">

<img src="https://img.shields.io/badge/-%20-0a4fa0?style=for-the-badge" height="6" width="900" />

<br><br>

<img src="https://img.shields.io/badge/SAFEROUTE-0a4fa0?style=for-the-badge&labelColor=041d50" height="50" />

<h3>From Report to Response</h3>

<p>
  <em>Guiding victims of online hate and gender-based violence<br>
  to the right support, institution, and legal pathway.</em>
</p>

<br>

<img src="https://img.shields.io/badge/Democracy%20Hackathon-2026-e8703a?style=flat-square&labelColor=9e2a06" />
<img src="https://img.shields.io/badge/Hack%20the%20Hate-Renew%20Democracy-0e6dd4?style=flat-square&labelColor=071e42" />
<img src="https://img.shields.io/badge/Council%20of%20Europe-Partner-3b8fe8?style=flat-square&labelColor=071e42" />

<br><br>

<img src="https://img.shields.io/badge/-%20-c94215?style=for-the-badge" height="6" width="900" />

</div>

<br>

## 🎯 The Hackathon

SafeRoute was built for the **Democracy Hackathon — "Hack the Hate, Renew Democracy"**, hosted in partnership with the **Council of Europe** and **Democracy Reporting International (DRI)**.

The challenge we answered:

> **"From Report to Response: Addressing Online Hate and Gender-Based Violence."**
> During elections, harmful content targeting women, trans, and non-binary candidates is widespread — yet the systems meant to respond to it are fragmented, slow, and hard to navigate. We were asked to design a tech-enabled solution that turns scattered, raw reports into structured evidence institutions can actually act on.

Over the course of the hackathon, our team designed and built a working prototype addressing that gap end to end — from the moment someone submits a report, to the moment an institution receives a clear, organized case file.

<br>

<table align="center">
<tr>
<td align="center" width="33%">

🟠 **The Problem**
Victims don't know where to report, and evidence gets lost along the way.

</td>
<td align="center" width="33%">

🔵 **Our Approach**
One guided path from incident to institution — evidence preserved, risk assessed, route made clear.

</td>
<td align="center" width="33%">

🟠 **The Outcome**
A working prototype, live and testable, covering both the victim and the institution side.

</td>
</tr>
</table>

<br>

---

<br>

## 🧭 What's in the Prototype

SafeRoute has two connected experiences:

| | |
|---|---|
| 👤 **Candidate Portal** | Submit evidence, get a plain-language summary, a risk score, and a clear next-step pathway. Track past cases and their status. |
| 🏛️ **Institution Dashboard** | View incoming cases sorted by urgency, see balanced suggested actions (never persuasive, never automatic), and make the final call as a human reviewer. |

Every case submitted is read and sorted into one of two tracks — **OGBV risk** (gendered abuse targeting someone's ability to participate safely in public life) or **suspected hate speech** (content that may cross a legal line) — because these are different problems that need different responses, not one blanket judgment.

<br>

---

<br>

## ⚙️ How It Works — The Pipeline

The core of SafeRoute isn't a single AI call — it's a **structured pipeline** that takes a raw, messy report and turns it into something an institution can actually use, with a clear decision boundary at every step:

```
  📥 Evidence submitted
        ↓
  🔍 Content & context extracted (text, images, links)
        ↓
  🧭 Dual-track classification — OGBV risk  /  suspected hate speech
        ↓
  📊 Risk scored, with a plain-language explanation attached
        ↓
  🗂️  Structured case file generated
        ↓
  🧑‍⚖️ Human review required — no case escalates on its own
        ↓
  ✅ Routed to the right institution
```

We used **AI assistance as one stage inside this pipeline** — specifically, to read submitted evidence and help generate the plain-language summary, the risk classification, and the suggested next steps. It is never the final decision-maker. Every single case sits behind a mandatory human review step before anything is escalated further, and the system is built to never automatically remove content or take action on its own. The pipeline — not the AI model — is the actual product.

<br>

---

<br>

## 🛠️ Built With

A brief note on the tools, since the people and the process mattered more than the stack:

<div align="center">

`React` · `Vite` — front-end interface
`Python` · `FastAPI` — back-end service
`Firebase` (Auth + Firestore) — accounts and case storage
`Gemini` — the AI step inside the evidence pipeline
`Railway` + `Vercel` — hosting

</div>

<br>

---

<br>

## 🤝 Built On Human Rights, Not Just Code

Four commitments shaped every decision in this prototype:

- 🔒 **Privacy by design** — sensitive data stays protected and restricted
- 🔍 **Explainability** — every assessment comes with a plain-language reason, never a black box
- 🧑‍⚖️ **Mandatory human review** — no case is ever escalated by an algorithm alone
- 🗣️ **No automatic censorship** — SafeRoute routes evidence, it never silences speech

<br>

---

<br>

## 🎥 Demo

<div align="center">

<br>

> 🎬 **Demo video:** *[link to be added]*

> 🌐 **Live website:** *[link to be added]*

<br>

</div>

<br>

---

<br>

<div align="center">

<img src="https://img.shields.io/badge/-%20-0a4fa0?style=for-the-badge" height="6" width="900" />

<br><br>

**Built by Elene Samsiani & Karina Osipova**
<sub>Democracy Hackathon 2026 · in partnership with the Council of Europe & Democracy Reporting International</sub>

<br>

<img src="https://img.shields.io/badge/From%20Report-to%20Response-e8703a?style=for-the-badge&labelColor=9e2a06" />

</div>
