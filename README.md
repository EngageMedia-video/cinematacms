# CinemataCMS: Privacy-First Video Platform for Asia-Pacific Social Issue Films

[Cinemata](https://cinemata.org) is an open-source video CMS built upon [MediaCMS](https://github.com/mediacms-io/mediacms), enhanced with features specifically designed for social issue filmmakers, human rights advocates, and civil society organisations across the Asia-Pacific region. Since its public release in 2021, Cinemata has grown to more than 7,000 films from 30+ countries.

The project is managed by [EngageMedia](https://engagemedia.org), an Asia-Pacific non-profit advocating for digital rights, open technology, and social issue films. Our goal is to make these Cinemata-specific integrations and improvements available to the public, enabling more organisations to build and maintain their own community video infrastructure — free from surveillance capitalism, algorithmic manipulation, and corporate content takedowns.

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

CinemataCMS is currently undergoing a full UX research and redesign engagement with [Kumquat](https://kumquat.cc), a Cape Town-based design consultancy, supported by the [Open Technology Fund's UX & Discovery Lab](https://opentech.fund/labs/ux-lab/).

This is not a cosmetic refresh. The engagement is grounded in research with the actual communities Cinemata serves — activist filmmakers, curators, human rights documentarians, and civil society partners across Southeast Asia — many of whom operate under surveillance or in contexts where platform design choices have real safety implications.

**What the engagement covers:**

- **UX research** — 5–8 interviews with filmmakers, curators, and partners; synthesis of existing survey data; audience archetypes and priority user journey mapping
- **Privacy-first design system** — A base component library built with accessibility, neurodiversity-friendly layouts, and clear privacy affordances (opt-in participation, anonymity states, data minimisation cues)
- **Full redesign of priority pages** — Homepage, film detail page, and editorial/discovery surfaces; responsive desktop and mobile layouts
- **Community engagement UX** — Design patterns for following/subscriptions, timeline comments, and contextual interaction that don't replicate surveillance-capitalism models
- **Developer handoff** — Dev-ready Figma files with annotated component guidance, aligned to the May–June 2026 implementation sprint

**Designs expected: late April 2026. Implementation: May–June 2026.**

The research phase is specifically attentive to Cinemata's unusual UX constraints: users balancing discoverability with anonymity, filmmakers wary of public distribution due to festival circuit norms, and audiences across 30+ countries with varying threat models and connectivity. The outputs will be reusable design patterns that other internet freedom projects can adapt.

This makes CinemataCMS one of the few open-source video platforms with both a third-party security audit and a dedicated, research-backed UX design process — both supported by OTF.

---

## Key Features

Built on [MediaCMS](https://github.com/mediacms-io/mediacms), with Cinemata-specific additions:

- **OTF-audited security** — MFA, X-Accel-Redirect media protection, session hardening
- **HLS video encryption** — AES-128 encrypted stream segments; Cloudflare-cacheable with Django-gated key delivery *(in progress)*
- **AI transcription** — [Whisper.cpp](https://github.com/ggml-org/whisper.cpp) integration for English translation and subtitle generation
- **SRT subtitle management** — Upload, edit, and download subtitle/caption files
- **Granular media privacy** — Public, private, and password-protected content with enforced file-level access controls
- **Expanded user roles** — Trusted User role with elevated publishing and ASR access; Curator role
- **Featured video scheduling** — Editorial control over homepage curation
- **Notification system** *(active development)* — Bell icon, in-app and email notifications
- **Timeline-based video commenting** *(active development)* — Comment at specific timestamps, rendered as Video.js markers
- **@Mention system** *(active development)* — User mentions in comments with autocomplete and notification triggers
- **User following and subscriptions** *(active development)*
- **Privacy-by-design** — No third-party tracker dependencies; self-hosted static assets; activity logging opt-out

---

## 💻 Developer Opportunities

We're building a vibrant developer community. **Paid opportunities** are available for developers based in Southeast Asia — part of our commitment to growing regional open-source capacity.

- Specific roadmap features may be designated for paid development
- Southeast Asian developers can apply through our [Expression of Interest Form](https://cinemata.org)
- Selection is based on relevant skills, experience, and commitment to the project's values
- Many features and improvements remain open for volunteer contributions from our global community

---

## Potential Use Cases

CinemataCMS is built for organisations that need to manage, showcase, and distribute video content with a focus on social impact — particularly where privacy, security, and sovereignty over content matter:

- **Human rights documentation** — NGOs and advocacy groups documenting sensitive situations, where secure hosting and access controls are essential
- **Activist archiving** — Community media groups preserving footage under threat of government censorship or platform removal
- **Film festivals** — Virtual and physical festivals hosting submissions and curated collections, including privacy-sensitive or politically sensitive work
- **Educational institutions** — Universities, film schools, and educational programmes building accessible archives of instructional and student content
- **Independent media organisations** — Documentary collectives and citizen journalism projects requiring secure hosting
- **Community archiving initiatives** — Cultural organisations preserving local stories and historical footage
- **Environmental advocacy** — Organisations documenting environmental issues and climate change impacts
- **Digital storytelling projects** — Initiatives using video as a tool for empowerment and social change

The platform's emphasis on privacy, security, and community engagement makes it particularly suitable for projects operating in contexts where content creators and their audiences face surveillance, harassment, or censorship risk.

---

## Screenshots

[![Homepage](https://github.com/EngageMedia-video/cinematacms/raw/main/images/IMG_1934.jpeg)](https://github.com/EngageMedia-video/cinematacms/blob/main/images/IMG_1934.jpeg)
[![Media Page](https://github.com/EngageMedia-video/cinematacms/raw/main/images/IMG_1935.jpeg)](https://github.com/EngageMedia-video/cinematacms/blob/main/images/IMG_1935.jpeg)
[![Whisper ASR](https://github.com/EngageMedia-video/cinemata/raw/main/images/Integration%20of%20Whisper%20ASR%20for%20English%20Translation.png)](https://github.com/EngageMedia-video/cinemata/blob/main/images/Integration%20of%20Whisper%20ASR%20for%20English%20Translation.png)
[![Upload](https://github.com/EngageMedia-video/cinematacms/raw/main/images/IMG_1931.jpeg)](https://github.com/EngageMedia-video/cinematacms/blob/main/images/IMG_1931.jpeg)

---

## Installation

The instructions below have been tested on Ubuntu 22.04. Make sure no other services are running on the system (specifically no nginx or PostgreSQL), as the installation script will install and configure them.

**Production install (as root):**
```bash
cd /home
mkdir cinemata && cd cinemata
git clone -b v2.1.4 https://github.com/EngageMedia-video/cinematacms.git cinematacms && cd cinematacms
chmod +x install.sh
./install.sh
```

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

### 🔄 Milestone 2: August 2025 – June 2026 (Current)

Active development focus through the Cinemata Community Assembly in June 2026.

**Platform stability and security (Feb–Mar 2026)**
- Bug fixes: bulk upload duplication, mobile header, Mainconcept codec compatibility
- Transcode and Celery concurrency optimisation
- AES-128 HLS stream encryption 

**Infrastructure and notifications (Feb–Apr 2026)**
- Notification system: bell icon UI, in-app notifications, email triggers on publish and interaction
- Whisper resource isolation to prevent transcoding conflicts

**Community engagement features (Apr–May 2026)**
- Timeline-based video commenting (timestamp-anchored comments rendered as Video.js markers)
- @Mention system in comments with autocomplete (Tribute.js) and notification triggers
- User following and subscription system

**UI redesign (May–Jun 2026)**
- Full homepage and film detail page redesign based on Kumquat UX research
- Delivered in partnership with [Kumquat](https://kumquat.cc) via OTF UX & Discovery Lab grant
- Privacy-first design system; responsive desktop and mobile layouts

### 📋 Milestone 3: Post-June 2026

Scope to be confirmed based on sustainability plan and community input at the June 2026 Assembly.

- Mobile-optimised design across all pages
- Filmmaker direct support / donation features
- Search and discovery improvements
- Members page with community algorithm
- Live streaming support
- Mobile native app (exploratory)

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

## About CinemataCMS 2.0

With CinemataCMS 2.0, we're building a community of developers, designers, and contributors who share our vision of bringing critical but often overlooked stories to the forefront. Join us in creating a platform that connects filmmakers, advocacy groups, human rights defenders, educators, and audiences — through collaborative initiatives such as film screenings, archiving, curation, outreach, and promotion.

By contributing to this project, you'll be part of an effort to make these tools available to a wider range of organisations, amplifying the impact of visual storytelling for social change across the Asia-Pacific and beyond.

In a region where freedom of expression faces increasing threats, CinemataCMS demonstrates that alternative digital spaces aren't just possible — they're necessary. Built by Southeast Asian developers for Asia-Pacific communities, this is technology that serves movements, not markets.

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

## Contributing

See [CONTRIBUTING.md](https://github.com/EngageMedia-video/cinematacms/blob/main/CONTRIBUTING.md) for guidelines. Questions? Open a [Discussion](https://github.com/EngageMedia-video/cinematacms/discussions) or reach us at [curators@cinemata.org](mailto:curators@cinemata.org).

## License

GNU GPL v3.0 — see [LICENSE](https://github.com/EngageMedia-video/cinematacms/blob/main/LICENSE).
