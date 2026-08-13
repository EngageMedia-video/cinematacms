# CinemataCMS: Privacy-First Video Platform for Asia-Pacific Social Issue Films

[Cinemata](https://cinemata.org) is an open-source video CMS for social issue filmmakers, human rights advocates, and civil society organisations across the Asia-Pacific region. It originated from [MediaCMS](https://github.com/mediacms-io/mediacms) but has since diverged into an independent codebase, now architecturally distinct, particularly on the frontend. Since its public release in 2021, Cinemata.org has grown to more than 7,300 films from 30+ countries.
 
The project is managed by [EngageMedia](https://engagemedia.org), an Asia-Pacific non-profit advocating for digital rights, open technology, and social issue films. The goal is to make Cinemata's work available to the public, so that more organisations can build and maintain their own community video platforms, free from surveillance capitalism, algorithmic manipulation, and corporate content takedowns.
 
In June 2026, the UN Special Rapporteur on freedom of opinion and expression, Irene Khan, named Cinemata in her final report to the Human Rights Council ([A/HRC/62/67](https://documents.un.org/), para. 96) as one of the infrastructural alternatives working to "de-oligarchize" information spaces, alongside the federated platform Mastodon and the data-standards project MyData Global. The report describes Cinemata as a non-profit platform for Asia-Pacific civic media, promoting regional solidarity across Indonesia, Malaysia, and the Philippines.

---

## 🔒 Security & Trust

CinemataCMS has undergone a comprehensive security audit by the [Open Technology Fund (OTF)](https://opentech.fund), confirming its suitability for protecting sensitive advocacy content. Key audit recommendations have been implemented, including:

- **Multi-Factor Authentication (MFA)** for administrator accounts
- **X-Accel-Redirect media file protection** — private files served only after Django permission checks, not directly via Nginx
- **Session management hardening** and API access controls
- **Frontend dependency security updates**

This makes CinemataCMS one of the few open-source video platforms with documented, third-party security review — particularly relevant for human rights organisations, activist archives, and civil society groups operating in high-risk or censorship-sensitive contexts. Read the full report [here](https://www.opentech.fund/security-safety-audits/cinemata/).

---

## 🎨 UX Redesign in Partnership with Kumquat (Supported by OTF)

CinemataCMS underwent a full UX research and redesign engagement with [Kumquat](https://kumquat.cc), a Cape Town-based design consultancy, supported by the [Open Technology Fund's UX & Discovery Lab](https://opentech.fund/labs/ux-lab/).
 
This was not a cosmetic refresh. The engagement was grounded in research with the communities Cinemata serves: activist filmmakers, curators, human rights documentarians, and civil society partners across Southeast Asia, many of whom operate under surveillance or in contexts where platform design choices have real safety implications.
 
**What the engagement covered:**
 
- **UX research**, with targeted interviews across filmmakers, curators, and partners; synthesis of existing survey data; audience archetypes and priority user journey mapping
- **Privacy-first design system**, a base component library built with accessibility, neurodiversity-friendly layouts, and clear privacy affordances (opt-in participation, anonymity states, data minimisation cues)
- **Full redesign of priority pages**, covering the homepage, film detail page, and editorial and discovery surfaces, with responsive desktop and mobile layouts
- **Community engagement UX**, design patterns for following and subscriptions, timeline comments, and contextual interaction that do not replicate surveillance-capitalism models
- **Developer handoff**, dev-ready Figma files with annotated component guidance
The redesigned interface launched at the first Cinemata Community Convening in Manila in June 2026. The outputs are reusable design patterns that other internet freedom projects can adapt. This makes CinemataCMS one of the few open-source video platforms with both a third-party security audit and a dedicated, research-backed UX design process, both supported by OTF.

---

## Key Features

Cinemata-specific features built on top of the platform's MediaCMS origins:
 
- **OTF-audited security**: MFA, X-Accel-Redirect media protection, session hardening
- **AES-128 HLS encryption**: encrypted stream segments, Cloudflare-cacheable with Django-gated key delivery
- **AI transcription**: [Whisper.cpp](https://github.com/ggml-org/whisper.cpp) integration for English translation and subtitle generation
- **SRT subtitle management**: upload, edit, and download subtitle and caption files
- **Granular media privacy**: public, private, and password-protected content with enforced file-level access controls
- **Scheduled visibility control**: set a film private during a festival window, with automatic public release after a chosen date
- **Community Impact recording**: impact measured as screenings, academic use, curation, and playlist inclusion, not view counts or viral metrics
- **Content sensitivity tagging**: films can be marked with sensitivity labels and context notes
- **Expanded user roles**: Trusted User role with elevated publishing and ASR access; Curator role; role badges on media pages and comments
- **Notification system**: bell icon, in-app and email notifications
- **Comment threads**: threaded discussion designed for screening debriefs rather than social-media reply chains
- **Bulk upload**: multi-film upload for institutional partners
- **Search and discovery**: multi-dimensional filters (region, topic, language, length, visibility) and a mobile-optimised search sheet, with curated content distinguished from user uploads
- **Upload progress and encoding status**: real-time progress, encoding state, and error messages
- **Privacy-by-design**: no third-party tracker dependencies, self-hosted static assets, activity logging opt-out


---

## ⚡ Modern Developer Experience

CinemataCMS has undergone a complete frontend modernisation — merged into `main` in
February 2026 — making it substantially easier to work on than most Django-based
video platforms of comparable age.

**What changed:**

- **React 17 → React 19** — The entire codebase runs on current React. All
  `ReactDOM.render` calls migrated to `createRoot`; breaking change fixes applied
  throughout ([#430](https://github.com/EngageMedia-video/cinematacms/pull/430))
- **Webpack → Vite** — ~760 lines of Webpack config replaced with ~80 lines of Vite
  config. Dev server cold start drops from 15–30 seconds to under 2 seconds. HMR
  from 2–5 seconds to under 500ms. Webpack has been entirely removed from the
  codebase ([#432](https://github.com/EngageMedia-video/cinematacms/pull/432))
- **django-vite integration** — Asset loading via `{% vite_asset %}` across all 27
  page entry points; content-hashed production builds with manifest; HMR in
  development mode via WebSocket
- **Dual-track architecture** — A clear, documented boundary between legacy code
  (leave it alone) and new code (use modern patterns):
  - **Legacy track**: existing Flux-based components; stable, untouched
  - **Modern track**: new features use React hooks, TanStack Query (server state),
    Zustand (client state), and Tailwind CSS v4
- **`/modern-demo` page** — A live, staff-accessible demonstration of the modern
  track architecture showing TanStack Query + Zustand + Tailwind v4 working together
  ([#434](https://github.com/EngageMedia-video/cinematacms/pull/434))
- **Contributor docs** — `CONTRIBUTING.md` documents the dual-track architecture,
  naming conventions (`components/-NEW-/`), dev workflow, and track boundary rules

---

## 💻 Developer Opportunities

We're building a vibrant developer community. **Paid opportunities** are available for developers based in Southeast Asia — part of our commitment to growing regional open-source capacity.

- Specific roadmap features may be designated for paid development
- Southeast Asian developers can apply through our [Expression of Interest Form](https://cinemata.org)
- Selection is based on relevant skills, experience, and commitment to the project's values
- Many features and improvements remain open for volunteer contributions from our global community

---

## Potential Use Cases

CinemataCMS is built for organisations that need to manage, showcase, and distribute video content with a focus on social impact, particularly where privacy, security, and sovereignty over content matter:
 
- **Human rights documentation**: NGOs and advocacy groups documenting sensitive situations, where secure hosting and access controls are essential
- **Activist archiving**: community media groups preserving footage under threat of government censorship or platform removal
- **Film festivals**: virtual and physical festivals hosting submissions and curated collections, including privacy-sensitive or politically sensitive work
- **Educational institutions**: universities, film schools, and educational programmes building accessible archives of instructional and student content
- **Independent media organisations**: documentary collectives and citizen journalism projects requiring secure hosting
- **Community archiving initiatives**: cultural organisations preserving local stories and historical footage
- **Environmental advocacy**: organisations documenting environmental issues and climate change impacts
- **Digital storytelling projects**: initiatives using video as a tool for empowerment and social change
The emphasis on privacy, security, and community engagement makes CinemataCMS particularly suitable for projects operating in contexts where content creators and their audiences face surveillance, harassment, or censorship risk.

---

## Screenshots

[![Homepage](https://github.com/EngageMedia-video/cinematacms/raw/main/images/IMG_1934.jpeg)](https://github.com/EngageMedia-video/cinematacms/blob/main/images/IMG_1934.jpeg)
[![Media Page](https://github.com/EngageMedia-video/cinematacms/raw/main/images/IMG_1935.jpeg)](https://github.com/EngageMedia-video/cinematacms/blob/main/images/IMG_1935.jpeg)
[![Whisper ASR](https://github.com/EngageMedia-video/cinemata/raw/main/images/Integration%20of%20Whisper%20ASR%20for%20English%20Translation.png)](https://github.com/EngageMedia-video/cinemata/blob/main/images/Integration%20of%20Whisper%20ASR%20for%20English%20Translation.png)
[![Upload](https://github.com/EngageMedia-video/cinematacms/raw/main/images/IMG_1931.jpeg)](https://github.com/EngageMedia-video/cinematacms/blob/main/images/IMG_1931.jpeg)

---

## Installation
The instructions below have been tested on Ubuntu 22.04. Make sure no other services are running on the system (specifically no Nginx or PostgreSQL), as the installation script will install and configure them.
 
**Production install (as root):**
 
```
cd /home
mkdir cinemata && cd cinemata
git clone -b v3.0.1 https://github.com/EngageMedia-video/cinematacms.git cinematacms && cd cinematacms
chmod +x install.sh
./install.sh
```

The installer runs database migrations and seeds django-waffle feature flag switches automatically.

**Local development (macOS or Windows):** See the [docs/](https://github.com/EngageMedia-video/cinematacms/tree/main/docs) directory for platform-specific setup guides.

> ⚠️ The `main` branch contains the latest development code and may include unstable features. Use a tagged release for production deployments.

**Check out [Index](docs/index.md)** for more information.

---

## Roadmap

### ✅ Milestone 1: January – July 2025 (Completed)
 
- OTF security audit response and implementation
- Full open-source release as CinemataCMS 2.0
- Multi-Factor Authentication for admin accounts
- Cloudflare Pro integration and chunked upload system
- Whisper.cpp ASR integration for English translation
- Comprehensive developer documentation and setup guides (Ubuntu, macOS, Windows, Docker)
- Virtual developer showcase and learning session
### ✅ Milestone 2: February – June 2026 (Completed)
 
Shipped over five months and launched at the first Cinemata Community Convening in Manila, June 2026.
 
**Platform and frontend**
 
- Frontend modernisation: React 17 to 19, Webpack to Vite, dual-track architecture
- AES-128 HLS encrypted streaming
- Transcode and Celery concurrency optimisation
**Notifications and community engagement**
 
- Notification system: bell icon UI, in-app notifications, email triggers
- Renewed comment system with threading
- Contributor role badges on media pages and comments
**Filmmaker and curator tools**
 
- Scheduled visibility control (festival-window privacy)
- Bulk upload for institutional partners
- Community Impact recording (screenings, academic use, curation, playlist inclusion)
- Content sensitivity tagging with context notes
- Upload progress and encoding status
- Profile and media management redesign
**Search and interface**
 
- Search and discovery overhaul: multi-dimensional filters and a mobile-optimised search sheet
- Full homepage and film detail page redesign (Kumquat, via OTF UX & Discovery Lab)
- Privacy-first design system, responsive desktop and mobile layouts
Some Milestone 2 work has complete backends but no frontend yet, and carries into Milestone 3: @mention wiring, the follow and subscribe UI, and notification preference toggles.
 
### 📋 Milestone 3: July 2026 – June 2027 (In planning)
 
Milestone 3 is being planned in public with the Technology Working Group formed at the Manila Convening, following the [Cinemata Community Governance Document](https://cinemata.org). Funded capacity this cycle is modest, so the plan is organised into two tracks.
 
**Core Track** is committed work that ships regardless of further funding. The focus is stewardship: keeping the platform stable, fast, and observable for the 7,300+ films that depend on it.
 
- **Fix-first security and stability**: closing a set of fail-open gaps found during planning, where a protection appears active but is not, and nothing alerts. This includes an encryption bypass, an IP-masking bypass on one media path, a mention notification that leaks a restricted film's title, and a filmmaker-initiated takedown for Community Impact entries.
- **Monitoring and visibility**: error tracking and alerting, so the team sees failures before filmmakers do.
- **Performance and delivery**: adaptive bitrate streaming and homepage load improvements, aimed at the platform's Asia-Pacific audience.
- **Finishing Milestone 2**: wiring the @mention frontend, the follow and subscribe UI, notification preference toggles, and Community Impact notifications.

**Horizon Track** is designed and estimated now so that if further funding lands, development starts within weeks. Nothing on this track is promised.
 
- Social share cards for films
- A collaborator and collaborative-playlist system, plus private and unlisted playlists
- A swipeable discovery feed, framed around discovery rather than retention
- Offline and low-bandwidth viewing support
- Deployability for other organisations: a production Docker Compose setup and a documentation site
- Progressive Web App capability as a near-term step ahead of any native mobile app
The final Milestone 3 plan will be published on the Cinemata blog and tracked on a public GitHub Projects board.
 
---

## History

Cinemata's content originates from EngageMedia's previous video platform, which operated from 2006 to 2020 using the Plumi video content management system. By migrating this valuable archive to an improved MediaCMS-based platform, we're ensuring the preservation and continued accessibility of essential narratives from the region. Since its 2021 launch, Cinemata has grown to more than 6,700 films contributed by filmmakers and curators across 30+ countries. Cinemata was co-developed with Markos Gogoulos of MediaCMS.

"Cinemata" comes from the combination of "cine", meaning "motion picture", and "mata", meaning "eye" in several regional languages:

- In Bahasa Malaysia, Bahasa Indonesia, and Filipino: **mata**
- In Tetum (East Timor): **matan**
- In Vietnamese: **mắt**
- In Thai and Lao: **ta**

"Cinemata" represents our focus on highlighting Asia-Pacific perspectives and connecting issues, films, and filmmakers across the region.

---

## Contributors

Thanks to all the amazing people who have contributed to this project:

[Markos Gogoulos](https://github.com/mgogoulos)
[Yiannis Stergiou](https://github.com/styiannis)
[Anna Helme](https://github.com/ahelme)
[King Catoy](https://github.com/Kingcatz)
[Ashraf Haque](https://github.com/securenetizen)
[Adryan Eka Vandra](https://github.com/adryanev)
[Jay Cruz](https://github.com/jmcruz14)
[John Henry Galino](https://github.com/jhgalino)
[Mico Balina](https://github.com/Micokoko)
[Khairunnisa Isma Hanifah](https://github.com/KhairunnisaIsma)
[Bea Mariano](https://github.com/beamariano)
[Jeremy Valentino Manik](https://github.com/jery1402)
[Aldhiya Rozak](https://github.com/Bejjoeqq)
[Naufal Fawwaz Andriawan](https://github.com/andriawan24)

## Contributing

See [CONTRIBUTING.md](https://github.com/EngageMedia-video/cinematacms/blob/main/CONTRIBUTING.md) for guidelines. Questions? Open a [Discussion](https://github.com/EngageMedia-video/cinematacms/discussions) or reach us at [curators@cinemata.org](mailto:curators@cinemata.org).

## License

GNU GPL v3.0 — see [LICENSE](https://github.com/EngageMedia-video/cinematacms/blob/main/LICENSE).
