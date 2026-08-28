# Engineering standards: AI-assisted contributions and merge controls

| Field | Value |
|---|---|
| Audience | CinemataCMS contributors, maintainers, and project stakeholders |
| Decided | 2026-08-18 |
| Status | Accepted. Initial controls are implemented or in pull request #894. |
| Decision owner | Project owner |

This document records the decision, contributor policy, rollout plan, evidence,
and reproduction commands. Each part has its own section so readers can skip to
the material they need.

## Decision

CinemataCMS accepts contributions made with AI assistance. Contributors must
disclose substantive AI assistance and remain responsible for everything they
submit.

CinemataCMS does not use AI-detection tools. Maintainers review the work, not
the contributor's writing style. `coderabbitai` remains advisory and cannot
approve or block a merge.

The project will protect `main`. Four existing CI checks must pass, and one
maintainer must approve each pull request. The project will also measure test
coverage before it sets any coverage requirement.

### AI contribution rules

The following rules apply to contributors and maintainers:

1. Disclose AI assistance when generated output remains in a contribution or
   materially shapes a design, implementation, test, or review decision.
2. Do not disclose exempt uses. These include inline completion that only
   finishes work already chosen by the contributor, renames, formatting, and
   translation or grammar correction of the contributor's own words.
3. Review, test, and understand every submitted change. The contributor remains
   responsible for the result.
4. Do not submit unattended machine output or use generated text in place of a
   technical explanation.
5. Do not submit AI-generated images, video, or audio. This restriction does not
   cover deterministic media processing performed by CinemataCMS.
6. Do not infer AI use from prose or code style.

A contribution that uses AI only for an exempt purpose selects the non-assisted
option in the pull request template.

### Required merge controls

The `CI` workflow currently runs these checks on pull requests to `main`:

- `Frontend Lint & Build`
- `Backend — Migrations Check`
- `Pre-commit (lint & format)`
- `Backend Tests`

GitHub matches required status checks by name. The branch rule must use these
exact names.

The repository also has dependency checks. Those jobs run only when a pull
request changes a dependency manifest. They must not become unconditional
required checks because they do not report a result on every pull request.

### Coverage starts as information

Before this rollout, the repository did not report backend or frontend
coverage. Counts of test files cannot replace coverage data. An adjacent test
file also does not prove that a source file is tested.

The project will first report coverage without blocking a pull request. After
one month of data, the project owner will decide whether to require coverage for
new and changed lines. No repository-wide target has been accepted.

## Why we chose this policy

AI tools can produce a large change faster than a maintainer can review it. A
disclosure tells the reviewer how the contributor worked and gives the project
data about AI-assisted contributions. It does not prove code provenance, grant
copyright, or reduce the contributor's responsibility.

### A ban would conflict with current work

Maintainers already use AI tools. A full ban would conflict with current
development practice and would be difficult to enforce without judging style.

That enforcement problem matters for CinemataCMS. Many contributors write in a
second or third language. A style-based accusation would put those contributors
at greater risk without establishing how the work was produced.

[Bevy's policy history](https://bevy.org/learn/contribute/policies/ai/#appendix-history-and-rationale)
supports this concern. Bevy replaced a full ban after finding that the ban
rewarded undisclosed use and forced reviewers to judge weak signals.

### Provenance remains a risk

Projects make different choices about AI-generated code. For example,
[QEMU declines AI-generated contributions](https://www.qemu.org/docs/master/devel/code-provenance.html#use-of-ai-generated-content)
because it considers their copyright and license status unsettled. Other
projects accept AI-assisted work when a person takes responsibility for it.

CinemataCMS chooses disclosure and human review. This decision does not claim
that disclosure resolves copyright or license questions. It also does not claim
that every AI-assisted contribution can or cannot satisfy the
[Developer Certificate of Origin](https://developercertificate.org/). The
project will revisit this decision if its license requirements change or a
specific provenance problem appears.

### Merge controls make the policy enforceable

The AI policy controls incoming work. Branch protection controls what reaches
`main`. The contributor policy has little value if a maintainer can merge a
pull request whose required checks failed.

## Contributor policy

This section applies to code, tests, documentation, pull request descriptions,
issues, and review comments.

### Declare substantive AI assistance

AI assistance is substantive when either condition is true:

- Generated output remains in the contribution.
- AI output materially shapes a design, implementation, test, or review
  decision.

Assistance is material when removing the tool's output would change the
submitted content or the approach used to produce it.

Select exactly one declaration in the pull request template:

- `This contribution includes substantive AI assistance.`
- `This contribution does not include substantive AI assistance.`

If you select the first option, name each tool and describe how you used it.
For example:

> Claude Code generated the first version of the migration and its tests. I
> changed the transaction boundary and added the rollback case.

If generated content remains in a commit, add this trailer:

```text
Assisted-by: <tool> <model-version>
```

Do not use `Co-Authored-By:` for an AI tool. GitHub treats that trailer as a
statement of authorship and adds the named author to the contributor list.

### Exempt uses

You do not need to declare these uses:

- An inline completion that only finishes code or prose you had already decided
  to write.
- A rename, formatter, or other mechanical edit that does not make a design
  decision.
- Translation of your own words.
- Grammar or spelling correction of your own words.

If all AI use falls within this list, select `This contribution does not include
substantive AI assistance.`

### Contributor responsibility

Before you submit a contribution:

1. Review every changed file.
2. Remove unrelated edits and generated commentary.
3. Run the checks that cover the changed behavior.
4. Record the commands and manual checks in the pull request.
5. Be ready to explain the design and implementation without asking the tool.

Do not weaken, skip, or delete a test to make a change pass.

A maintainer may close a contribution without further review when the
contributor does not correct one of these problems after a clear request:

- The change contains unrelated files or formatting churn.
- The change disables a required check or test.
- The pull request omits the verification needed for its claims.
- The contributor cannot answer a technical question about the submitted work.
- The issue, pull request, or review comment contains raw generated output in
  place of the contributor's explanation.

These conditions concern the work and the contributor's verification. They do
not concern writing style.

### Contributions we do not accept

CinemataCMS does not accept these contributions:

- A submission made by an unattended agent with no responsible contributor.
- AI-generated images, video, or audio in the product or its documentation.
- Generated messages posted in place of a contributor's own technical response.

Using CinemataCMS to process media through its existing deterministic tools does
not fall under the media restriction.

### Review rules

Maintainers judge scope, behavior, tests, security, and maintainability. They do
not use AI-detection tools or treat prose and code style as evidence of AI use.

If a declaration appears inaccurate, ask the contributor about the workflow and
the submitted evidence. Do not ask the contributor to prove that a tool was not
used.

`coderabbitai` reviews pull requests in this repository. Its comments are
advisory. A human maintainer decides whether the contribution is ready.

## Rollout plan

Complete the work in this section in order.

| Work | Status on 2026-08-27 | Completion evidence |
|---|---|---|
| Publish this policy | Implemented in pull request #894 | `CONTRIBUTING.md` links to this section |
| Add declaration fields to the pull request template | Implemented in pull request #894 | The template contains both fields |
| Validate the declaration in CI | Implemented in pull request #894; activates after merge | Parser tests cover zero, one, and two selections, whitespace, and unrelated checkboxes |
| Label declared AI assistance | Implemented in pull request #894; activates after merge | The workflow adds or removes `ai-assisted` from the selected declaration |
| Protect `main` | Complete | The GitHub API reports the four required checks, one write-permission approval, latest-push approval, administrator enforcement, and disabled force pushes and deletion |
| Report coverage | Implemented in pull request #894 | The existing backend and frontend jobs publish informational summaries |
| Decide a changed-line target | Deferred | Review starts after one month of coverage data |

### Protect `main`

The branch rule for `main` was configured and first confirmed on 2026-08-27.
Review freshness was added on 2026-08-28. The rule has these settings:

1. Require a pull request before merging.
2. Require one approval from a reviewer with write permission.
3. Require approval of the most recent reviewable push by someone other than
   the person who pushed it.
4. Require the four status checks named in the decision section.
5. Apply the rule to administrators.
6. Block direct pushes, force pushes, and branch deletion.

Do not require jobs from `.github/workflows/dependabot-check.yml`. Those jobs
run only when dependency manifests change.

After the rule is saved, run:

```bash
gh api repos/EngageMedia-video/cinematacms/branches/main/protection \
	--jq '{checks: .required_status_checks.contexts, pull_request_reviews: (.required_pull_request_reviews != null), approvals: .required_pull_request_reviews.required_approving_review_count, latest_push_approval: .required_pull_request_reviews.require_last_push_approval, admins: .enforce_admins.enabled, force_pushes: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled}'
```

The result verified on 2026-08-28 lists all four checks and reports
`pull_request_reviews: true`, `approvals: 1`, `latest_push_approval: true`,
`admins: true`, `force_pushes: false`, and `deletions: false`. GitHub counts the
required approval only from a reviewer with write permission.

### Validate the AI declaration

`.github/workflows/ai-declaration.yml` reads the pull request body and counts
the two declaration fields from `.github/PULL_REQUEST_TEMPLATE.md`.

The job must behave as follows:

| Selected fields | Result |
|---|---|
| Zero | Fail with instructions to select one field |
| One | Pass |
| Two | Fail with instructions to clear one field |

The parser tests cover edited whitespace and unrelated checkboxes. The parser
does not infer AI use from any other text in the pull request.

The workflow uses `pull_request_target` so it can label pull requests from
forks. It checks out the validator from the default branch and does not execute
code from the pull request. It writes a commit status named `AI declaration`.

Add the job to the branch rule only after the workflow is on `main` and has
reported a result on a pull request. GitHub blocks a merge indefinitely when a
required check never starts.

### Add the declaration label

When the substantive-assistance field is selected, the workflow adds an
`ai-assisted` label. It removes the label when the contributor changes the
declaration.

The label records volume. It does not change review priority or approval rules.

### Report coverage

The existing backend and frontend test jobs collect coverage and report these
values separately:

- Backend Python coverage.
- Modern frontend coverage under `frontend/src/features/`.
- Legacy frontend coverage under `frontend/src/static/js/`.

The backend job uses Coverage.py with branch coverage. It runs
`coverage run manage.py test` against `actions`, `cms`, `files`,
`notifications`, `uploader`, and `users`. It omits migrations, tests, and empty
files from the report.

The frontend job uses the Vitest V8 provider and runs
`npm run test:coverage`. It includes JavaScript and JSX under
`frontend/src/features/` and `frontend/src/static/js/`. It excludes tests, test
setup, and
`frontend/src/static/js/components/-NEW-/InlineSliderItemListAsync.js`. That
legacy file contains JSX under a `.js` extension, which the V8 provider cannot
remap when the file is uncovered.

Each job publishes its values in the workflow run summary and uploads JSON
coverage data with 30-day retention. These reports and artifacts form the
baseline for the one-month observation period. This phase is informational: a
coverage decrease does not block a pull request.

Record the tool, command, included paths, excluded paths, and baseline artifact
in the implementation pull request. The report must distinguish full-repository
coverage from coverage of new and changed lines.

Collect one month of data before proposing a target.

### Decide whether changed-line coverage must pass

After one month, review the data and answer these questions:

- Is the measurement stable across ordinary pull requests?
- Which test suites produce useful changed-line coverage?
- What target would have failed recent valid fixes?
- Should legacy frontend changes remain informational?
- How often did contributors add weak tests only to increase the number?

Record the result in a new decision document. Do not change this accepted
decision by editing its history.

### Keep an urgent-fix path

`main` deploys to the development server. An urgent correction still requires a
pull request, the required checks, and one approval. Reverting the faulty change
is often the shortest safe correction.

Review this rule before applying the same protection to a branch that deploys to
users.

## Evidence

This section records the repository data used for the decision. It describes
the snapshot, method, results, and limits. It does not set policy.

### Fixed snapshot

| Field | Value |
|---|---|
| Repository ref | `0f3bb19357d35e03fa3b7a188f055b6ed6d860f4` |
| Ref commit date | 2026-08-06 |
| Measurement date | 2026-08-18 |
| History start | `2025-08-18T00:00:00+07:00` |
| Merge commits | Excluded from `fix` and latency measurements |

All repository measurements use the fixed commit. The commands do not use
`origin/main`, `HEAD`, or a relative date.

Before the branch rule was configured on 2026-08-27, the GitHub API returned
`404 Branch not protected`:

```bash
gh api repos/EngageMedia-video/cinematacms/branches/main/protection
```

### Definitions

A `fix` commit has a subject that starts with `fix`. The method does not inspect
the body of the commit message.

A backend source file is a Python file that is not a migration and whose name
does not start with `test_`.

A modern frontend source file is a JavaScript or TypeScript file under
`frontend/src/features/` whose name does not contain `.test.`. A legacy frontend
source file follows the same rule under `frontend/src/static/js/`.

A source-file touch is one source file changed by one `fix` commit. A file
changed by three `fix` commits contributes three touches.

An adjacent test has the same stem as the frontend source file and uses
`.test.js`, `.test.jsx`, `.test.ts`, or `.test.tsx` in the same directory.
Adjacency does not prove that the test imports or executes the source file.

### Repository results

The fixed snapshot contains 706 commits from 2025-04-17 through 2026-08-06.
The measurement period contains 85 `fix` commits.

The last 200 commits contain 68 `feat` commits and 65 `fix` commits. Of the last
30 commit subjects, 28 end with a pull request number.

#### Test and source file counts

| Area | Test files | Source files |
|---|---:|---:|
| Backend Python | 48 | 112 |
| Modern frontend | 107 | 413 |
| Legacy frontend | 4 | 266 |

These are file counts, not coverage measurements.

#### Source-file touches in `fix` commits

| Area | Source-file touches | Source files | Touches per source file |
|---|---:|---:|---:|
| Backend Python | 79 | 112 | 0.71 |
| Modern frontend | 141 | 413 | 0.34 |
| Legacy frontend | 20 | 266 | 0.08 |

#### Adjacent frontend tests

| Area | Touches with an adjacent test | All touches | Rate |
|---|---:|---:|---:|
| Modern frontend | 55 | 141 | 39.0% |
| Legacy frontend | 2 | 20 | 10.0% |
| All frontend | 57 | 161 | 35.4% |

For 104 of 161 frontend source-file touches, the fixed snapshot has no adjacent
same-name test file. This is 64.6% of touches. The result does not show that
64.6% of frontend code is untested.

#### Time between a feature and the next fix to the same file

The method pairs the first `feat` touch for a file with the next `fix` touch for
that file. It found 250 pairs.

| Measurement | Result |
|---|---:|
| Median | 10.3 days |
| At most 7 days | 39.2% |
| At most 30 days | 64.4% |

The pairing shows temporal proximity. It does not prove that the `feat` commit
caused the later fix.

#### Changed-line heuristic

The heuristic classifies a changed line as appearance-related when the line is
in a CSS or SCSS file or contains `className=`, `class=`, `style=`, or
`styled.`. A commit is appearance-heavy when at least 80% of its changed lines
match. A commit is logic-like when fewer than 50% match.

| Result | Count | Rate |
|---|---:|---:|
| Frontend-only `fix` commits | 30 | 100.0% |
| Logic-like frontend-only commits | 20 | 66.7% |
| Appearance-heavy frontend-only commits | 9 | 30.0% |
| Appearance-heavy commits among all 85 fixes | 12 | 14.1% |

The heuristic classifies changed text. It does not classify the defect. The
thresholds are choices, not measurements.

### Repeat the measurements

Verify that the fixed commit is available:

```bash
git cat-file -e 0f3bb19357d35e03fa3b7a188f055b6ed6d860f4^{commit}
```

If the command fails, fetch the commit from `origin` before continuing.

Run the small measurements directly:

```bash
REF=0f3bb19357d35e03fa3b7a188f055b6ed6d860f4
SINCE=2025-08-18T00:00:00+07:00

git log "$REF" --since="$SINCE" --no-merges --format='%s' \
	| grep -cE '^fix'

git log "$REF" -200 --format='%s' \
	| sed -E 's/^([a-z]+)(\(.*\))?:.*/\1/' \
	| grep -E '^[a-z]+$' \
	| sort \
	| uniq -c \
	| sort -rn

git log "$REF" -30 --format='%s' \
	| grep -cE '\(#[0-9]+\)$'
```

Run this script for source-file touches, adjacent tests, latency, and the
changed-line heuristic:

```python
import collections
import os
import re
import statistics
import subprocess

REF = "0f3bb19357d35e03fa3b7a188f055b6ed6d860f4"
SINCE = "2025-08-18T00:00:00+07:00"


def run(*args):
	return subprocess.run(
		args,
		check=True,
		capture_output=True,
		text=True,
	).stdout


def history():
	output = run(
		"git",
		"log",
		REF,
		f"--since={SINCE}",
		"--no-merges",
		"--format=%H%x09%ct%x09%s",
	)
	return [line.split("\t", 2) for line in output.splitlines()]


def commits(prefix):
	return [
		(sha, int(timestamp))
		for sha, timestamp, subject in history()
		if subject.startswith(prefix)
	]


def files_of(sha):
	output = run("git", "show", "--name-only", "--format=", sha)
	return [path for path in output.splitlines() if path]


def is_frontend_source(path):
	return re.search(r"\.(jsx?|tsx?)$", path) and ".test." not in path


fixes = commits("fix")
tree = set(run("git", "ls-tree", "-r", "--name-only", REF).splitlines())
areas = {
	"backend": lambda path: path.endswith(".py")
	and "/migrations/" not in path
	and not os.path.basename(path).startswith("test_"),
	"modern": lambda path: path.startswith("frontend/src/features/")
	and is_frontend_source(path),
	"legacy": lambda path: path.startswith("frontend/src/static/js/")
	and is_frontend_source(path),
}
source = {
	area: sum(1 for path in tree if predicate(path))
	for area, predicate in areas.items()
}
touches = collections.Counter()

for sha, _ in fixes:
	for path in files_of(sha):
		for area, predicate in areas.items():
			if predicate(path):
				touches[area] += 1

print(f"fix commits: {len(fixes)}")
for area in areas:
	print(
		f"{area} touches: {touches[area]}/{source[area]} = "
		f"{touches[area] / source[area]:.2f}"
	)


def has_adjacent_test(path):
	directory = os.path.dirname(path)
	filename = os.path.basename(path)
	stem = re.sub(r"\.(jsx?|tsx?)$", "", filename)
	return any(
		f"{directory}/{stem}.test.{extension}" in tree
		for extension in ("js", "jsx", "ts", "tsx")
	)


adjacent = collections.defaultdict(lambda: [0, 0])
for sha, _ in fixes:
	for path in files_of(sha):
		for area in ("modern", "legacy"):
			if areas[area](path):
				adjacent[area][1] += 1
				adjacent[area][0] += has_adjacent_test(path)

print("adjacent tests")
for area in ("modern", "legacy"):
	with_test, total = adjacent[area]
	print(f"{area}: {with_test}/{total} = {100 * with_test / total:.1f}%")

rows = list(reversed(history()))
first_feature = {}
latency = []
for sha, timestamp, subject in rows:
	changed = files_of(sha)
	if subject.startswith("feat"):
		for path in changed:
			first_feature.setdefault(path, int(timestamp))
	elif subject.startswith("fix"):
		for path in changed:
			if path in first_feature:
				latency.append(
					(int(timestamp) - first_feature.pop(path)) / 86400
				)

print(f"feature-to-fix pairs: {len(latency)}")
print(f"median: {statistics.median(latency):.1f} days")
print(f"within 7 days: {100 * sum(day <= 7 for day in latency) / len(latency):.1f}%")
print(f"within 30 days: {100 * sum(day <= 30 for day in latency) / len(latency):.1f}%")

appearance_pattern = re.compile(r"(className=|class=|style=|styled\.)")


def appearance_share(sha):
	current = None
	appearance = 0
	changed = 0
	output = run("git", "show", "--unified=0", "--format=", sha)
	for line in output.splitlines():
		header = re.match(r"\+\+\+ b/(.*)", line)
		if header:
			current = header.group(1)
			continue
		if line.startswith(("+++", "---", "@@")):
			continue
		if not line.startswith(("+", "-")):
			continue
		changed += 1
		if (
			current
			and current.endswith((".css", ".scss"))
			or appearance_pattern.search(line)
		):
			appearance += 1
	return appearance / changed if changed else 0, changed


frontend_only = 0
logic_like = 0
appearance_heavy = 0
appearance_heavy_all = 0
for sha, _ in fixes:
	changed_files = files_of(sha)
	share, changed = appearance_share(sha)
	if not changed_files or changed == 0:
		continue
	appearance_heavy_all += share >= 0.8
	if all(path.startswith("frontend/") for path in changed_files):
		frontend_only += 1
		appearance_heavy += share >= 0.8
		logic_like += share < 0.5

print(f"frontend-only fixes: {frontend_only}")
print(f"logic-like: {logic_like}")
print(f"appearance-heavy: {appearance_heavy}")
print(f"appearance-heavy among all fixes: {appearance_heavy_all}")
```

Expected output:

```text
fix commits: 85
backend touches: 79/112 = 0.71
modern touches: 141/413 = 0.34
legacy touches: 20/266 = 0.08
adjacent tests
modern: 55/141 = 39.0%
legacy: 2/20 = 10.0%
feature-to-fix pairs: 250
median: 10.3 days
within 7 days: 39.2%
within 30 days: 64.4%
frontend-only fixes: 30
logic-like: 20
appearance-heavy: 9
appearance-heavy among all fixes: 12
```

### Limits of the evidence

- Commit prefixes describe intent, not the actual defect.
- Source-file touches are not unique files.
- An adjacent test file is not proof of coverage.
- Feature-to-fix proximity does not establish causation.
- The changed-line heuristic does not inspect behavior.
- The legacy adjacent-test result contains only 20 touches.
- Branch protection is external state and can change after the measurement date.

## Sources

- [Bevy AI policy and history](https://bevy.org/learn/contribute/policies/ai/)
- [QEMU code provenance policy](https://www.qemu.org/docs/master/devel/code-provenance.html#use-of-ai-generated-content)
- [Rust policy on LLM-generated content](https://forge.rust-lang.org/policies/llm-usage.html)
- [Developer Certificate of Origin 1.1](https://developercertificate.org/)
- [GitHub protected branch review requirements](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [OpenAI's retired AI classifier](https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/)
- [Daniel Stenberg on ending curl's bug bounty](https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/)
- [Daniel Stenberg on curl security reporting](https://daniel.haxx.se/blog/2026/02/25/curl-security-moves-again/)
