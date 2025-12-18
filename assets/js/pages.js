/* assets/js/pages.js
 * Renders Guide / Troubleshooting / Changelog
 * - Guide loads markdown sections from data/guide-sections.json
 * - Drawer Quick Jump works from ANY route (auto navigates to #/guide then scrolls)
 * - Troubleshooting loads approved issues from GitHub API (with category filtering)
 */

class Pages {
	static pendingScrollIdKey = "__revo_pending_scroll_id";

	// ---------- Utilities ----------
	static setPendingScrollId(id) {
		try {
			sessionStorage.setItem(Pages.pendingScrollIdKey, id);
		} catch {}
	}

	static consumePendingScrollId() {
		try {
			const id = sessionStorage.getItem(Pages.pendingScrollIdKey);
			if (id) sessionStorage.removeItem(Pages.pendingScrollIdKey);
			return id || null;
		} catch {
			return null;
		}
	}

	static headerOffsetPx() {
		const header = document.querySelector(".site-header");
		const h = header ? header.getBoundingClientRect().height : 84;
		return Math.round(h + 14);
	}

	static scrollToId(id) {
		const el = document.getElementById(id);
		if (!el) return false;

		// Use scrollIntoView then correct with offset (more reliable than only CSS in some cases)
		el.scrollIntoView({ behavior: "smooth", block: "start" });
		window.setTimeout(() => {
			window.scrollBy({ top: -Pages.headerOffsetPx(), left: 0, behavior: "smooth" });
		}, 60);

		return true;
	}

	static async goToGuideAndScroll(id) {
		// If already on guide, just scroll
		const hash = window.location.hash || "#/guide";
		if (hash.startsWith("#/guide") || hash === "#/" || hash === "#") {
			Pages.scrollToId(id);
			return;
		}

		// Otherwise: set pending id, navigate to guide
		Pages.setPendingScrollId(id);
		window.location.hash = "#/guide";
	}

	static escapeHtml(text) {
		return String(text)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	static async fetchText(path) {
		const res = await fetch(path, { cache: "no-store" });
		if (!res.ok) throw new Error(`Failed to fetch: ${path} (${res.status})`);
		return await res.text();
	}

	static async fetchJson(path) {
		const res = await fetch(path, { cache: "no-store" });
		if (!res.ok) throw new Error(`Failed to fetch JSON: ${path} (${res.status})`);
		return await res.json();
	}

	// ---------- Guide ----------
	static async renderGuide(container) {
		container.innerHTML = `
			<section class="container page-shell page-enter">
				<div class="page-hero">
					<div class="eyebrow">GUIDE</div>
					<h1>Revolution Macro, clearly explained.</h1>
					<p class="lead">Install, configure, and optimize the macro without guesswork.</p>
				</div>

				<div class="surface guide-grid single">
					<div class="prose" id="guideRoot">
						<div class="loading"><div class="spinner"></div></div>
					</div>
				</div>
			</section>
		`;

		// Load sections list
		const guideRoot = document.getElementById("guideRoot");
		let sectionsJson;
		try {
			sectionsJson = await Pages.fetchJson("data/guide-sections.json");
		} catch (e) {
			console.error(e);
			guideRoot.innerHTML = `
				<div class="empty-state">
					<div class="empty-icon">⚠️</div>
					<div>Could not load <code>data/guide-sections.json</code>.</div>
				</div>
			`;
			return;
		}

		const sections = Array.isArray(sectionsJson?.sections) ? sectionsJson.sections : [];

		// Render markdown in-order into ONE guide page (your “full guide”)
		let html = "";
		for (const s of sections) {
			try {
				const md = await Pages.fetchText(s.file);
				// markdown.render() provided by assets/js/markdown.js
				const rendered = window.markdown?.render
					? window.markdown.render(md)
					: `<pre>${Pages.escapeHtml(md)}</pre>`;

				// Wrap each section with a stable id for quick jump
				// We are NOT changing your internal markdown wording; this is a container wrapper only.
				html += `
					<section class="guide-section" id="${Pages.escapeHtml(s.id)}">
						${rendered}
					</section>
				`;
			} catch (e) {
				console.error(e);
				html += `
					<section class="guide-section" id="${Pages.escapeHtml(s.id)}">
						<div class="empty-state">
							<div class="empty-icon">⚠️</div>
							<div>Could not load <code>${Pages.escapeHtml(s.file)}</code>.</div>
						</div>
					</section>
				`;
			}
		}

		guideRoot.innerHTML = html || `
			<div class="empty-state">
				<div class="empty-icon">📄</div>
				<div>No guide sections found.</div>
			</div>
		`;

		// Build Quick Jump items in drawer
		Pages.renderDrawerGuideNav(sections);

		// If we came here from another tab using quick jump, consume and scroll
		const pending = Pages.consumePendingScrollId();
		if (pending) {
			// slight delay to ensure DOM is ready
			window.setTimeout(() => {
				Pages.scrollToId(pending);
			}, 120);
		}
	}

	static renderDrawerGuideNav(sections) {
		const host = document.getElementById("drawerGuideNav");
		if (!host) return;

		// Keep exactly 6 quick-jump buttons if you want (example uses the first 6 guide sections)
		// If you prefer specific 6, you can change which IDs are used here.
		const quick = sections.slice(0, 6);

		host.innerHTML = quick
			.map((s, idx) => {
				const title = s.titleEn || s.id;
				return `
					<button class="guide-link" type="button" data-jump-id="${Pages.escapeHtml(s.id)}">
						<span class="guide-index">${idx + 1}</span>
						<span class="guide-text">${Pages.escapeHtml(title)}</span>
					</button>
				`;
			})
			.join("");

		// Add "Top" button at bottom of the drawer quick jump
		host.insertAdjacentHTML(
			"beforeend",
			`
			<button class="guide-link" type="button" data-jump-top="1">
				<span class="guide-index">↑</span>
				<span class="guide-text">Top</span>
			</button>
		`
		);

		// Bind click behavior
		host.querySelectorAll("[data-jump-id]").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const id = btn.getAttribute("data-jump-id");
				if (!id) return;
				// close drawer
				document.dispatchEvent(new CustomEvent("revo:drawer-close"));
				await Pages.goToGuideAndScroll(id);
			});
		});

		host.querySelectorAll("[data-jump-top]").forEach((btn) => {
			btn.addEventListener("click", () => {
				document.dispatchEvent(new CustomEvent("revo:drawer-close"));
				window.scrollTo({ top: 0, behavior: "smooth" });
			});
		});
	}

	// ---------- Troubleshooting ----------
	static async renderTroubleshooting(container) {
		// Submit Fix: website repo
		const submitFixUrl =
			"https://github.com/RevolutionGuides/revolutionmacroguide/issues/new" +
			"?title=" +
			encodeURIComponent("Fix request: [short title]") +
			"&labels=" +
			encodeURIComponent("needs-review,troubleshooting") +
			"&body=" +
			encodeURIComponent(
				[
					"## What’s the problem?",
					"",
					"(Describe what went wrong. Include exact error text if possible.)",
					"",
					"## Category",
					"",
					"- [ ] windows",
					"- [ ] macos",
					"- [ ] macro",
					"- [ ] pro",
					"",
					"## Steps to reproduce",
					"",
					"1.",
					"2.",
					"3.",
					"",
					"## What fixed it?",
					"",
					"(Explain the fix clearly. If you have screenshots, paste links.)",
				].join("\n")
			);

		const openIssuesUrl =
			"https://github.com/RevolutionGuides/revolutionmacroguide/issues?q=is%3Aissue+is%3Aopen+label%3Atroubleshooting";

		container.innerHTML = `
			<section class="container page-shell page-enter">
				<div class="page-hero">
					<div class="eyebrow">TROUBLESHOOTING</div>
					<h1>Find and apply the fix fast.</h1>
					<p class="lead">Filter by category, search keywords, and open the exact walkthrough.</p>

					<div class="hero-actions" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
						<a class="btn btn-ghost" href="${openIssuesUrl}" target="_blank" rel="noopener noreferrer">Open Issues</a>
						<a class="btn btn-primary" href="${submitFixUrl}" target="_blank" rel="noopener noreferrer">Submit Fix</a>
					</div>
				</div>

				<div class="surface">
					<div class="toolbar">
						<div class="search">
							<span class="search-icon">🔎</span>
							<input id="fixSearch" type="text" placeholder="Search fixes..." autocomplete="off" />
						</div>

						<div class="filter-chips" id="fixFilters">
							<button class="chip active" data-cat="all" type="button">All</button>
							<button class="chip" data-cat="windows" type="button">Windows</button>
							<button class="chip" data-cat="macos" type="button">macOS</button>
							<button class="chip" data-cat="macro" type="button">Macro</button>
							<button class="chip" data-cat="pro" type="button">Pro</button>
						</div>
					</div>

					<div id="fixList" class="accordion-list">
						<div class="loading"><div class="spinner"></div></div>
					</div>
				</div>
			</section>
		`;

		const list = document.getElementById("fixList");
		const input = document.getElementById("fixSearch");
		const filters = document.getElementById("fixFilters");

		let activeCat = "all";
		let query = "";

		// Pull issues labeled "approved" from your site repo (already in your api.js)
		const issues = (await githubAPI.getTroubleshootingIssues("approved")) || [];
		const normalized = issues
			.filter((i) => !i.pull_request) // skip PRs
			.map((i) => {
				const title = i.title || "";
				const body = i.body || "";
				const labels = (i.labels || []).map((l) => String(l.name || "").toLowerCase());

				// Determine category based on labels
				// Expected labels: windows, macos (or mac), macro, pro
				let cat = "macro";
				if (labels.includes("windows")) cat = "windows";
				else if (labels.includes("macos") || labels.includes("mac")) cat = "macos";
				else if (labels.includes("pro")) cat = "pro";
				else if (labels.includes("macro")) cat = "macro";

				return {
					id: i.id,
					number: i.number,
					title,
					body,
					html_url: i.html_url,
					labels,
					category: cat,
				};
			});

		function matches(item) {
			const inCat = activeCat === "all" ? true : item.category === activeCat;
			if (!inCat) return false;

			if (!query) return true;
			const q = query.toLowerCase();
			return (
				item.title.toLowerCase().includes(q) ||
				item.body.toLowerCase().includes(q) ||
				item.labels.some((l) => l.includes(q))
			);
		}

		function pillForCat(cat) {
			if (cat === "windows") return "Windows";
			if (cat === "macos") return "macOS";
			if (cat === "pro") return "Pro";
			return "Macro";
		}

		function renderItems() {
			const items = normalized.filter(matches);

			if (!items.length) {
				list.innerHTML = `
					<div class="empty-state">
						<div class="empty-icon">🧩</div>
						<div>No fixes match your filters.</div>
					</div>
				`;
				return;
			}

			list.innerHTML = items
				.map((item) => {
					// Body is markdown; render and sanitize
					const rendered = window.markdown?.render
						? window.markdown.render(item.body)
						: `<pre>${Pages.escapeHtml(item.body)}</pre>`;

					return `
						<div class="accordion-card" data-acc="card">
							<button class="accordion-head" type="button" data-acc="toggle" aria-expanded="false">
								<div class="accordion-meta">
									<span class="pill">${pillForCat(item.category)}</span>
									<span class="accordion-title">${Pages.escapeHtml(item.title)}</span>
								</div>
								<span class="chevron">▼</span>
							</button>

							<div class="accordion-body" data-acc="body">
								<div class="prose">
									${rendered}
									<div style="margin-top:12px;">
										<a class="btn btn-ghost" href="${item.html_url}" target="_blank" rel="noopener noreferrer">
											Open on GitHub (#${item.number})
										</a>
									</div>
								</div>
							</div>
						</div>
					`;
				})
				.join("");

			// Accordion behavior (clickable!)
			list.querySelectorAll('[data-acc="toggle"]').forEach((btn) => {
				btn.addEventListener("click", () => {
					const card = btn.closest('[data-acc="card"]');
					const body = card?.querySelector('[data-acc="body"]');
					if (!card || !body) return;

					const isOpen = card.classList.toggle("open");
					btn.setAttribute("aria-expanded", String(isOpen));

					// Animate max-height
					if (isOpen) {
						body.style.maxHeight = body.scrollHeight + 28 + "px";
					} else {
						body.style.maxHeight = "0px";
					}
				});
			});
		}

		// Filters
		filters.querySelectorAll(".chip").forEach((btn) => {
			btn.addEventListener("click", () => {
				filters.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
				activeCat = btn.getAttribute("data-cat") || "all";
				renderItems();
			});
		});

		// Search
		input.addEventListener("input", () => {
			query = input.value || "";
			renderItems();
		});

		renderItems();
	}

	// ---------- Changelog ----------
	static async renderChangelog(container) {
		container.innerHTML = `
			<section class="container page-shell page-enter">
				<div class="page-hero">
					<div class="eyebrow">CHANGELOG</div>
					<h1>Latest releases.</h1>
					<p class="lead">Live fetched from GitHub releases.</p>
				</div>

				<div class="surface" id="changelogRoot">
					<div class="loading"><div class="spinner"></div></div>
				</div>
			</section>
		`;

		const root = document.getElementById("changelogRoot");
		const releases = (await githubAPI.getReleases()) || [];

		if (!releases.length) {
			root.innerHTML = `
				<div class="empty-state">
					<div class="empty-icon">📦</div>
					<div>No releases found.</div>
				</div>
			`;
			return;
		}

		root.innerHTML = releases
			.map((r) => {
				const name = r.name || r.tag_name || "Release";
				const date = r.published_at ? githubAPI.formatDate(r.published_at) : "";
				const body = r.body || "";
				const rendered = window.markdown?.render
					? window.markdown.render(body)
					: `<pre>${Pages.escapeHtml(body)}</pre>`;

				return `
					<div class="accordion-card open" style="margin-bottom:12px;">
						<div class="accordion-head" style="cursor:default;">
							<div class="accordion-meta">
								<span class="pill">Release</span>
								<span class="accordion-title">${Pages.escapeHtml(name)}</span>
								<span style="margin-left:10px;opacity:.65;font-weight:800;">${Pages.escapeHtml(date)}</span>
							</div>
							<a class="btn btn-ghost" href="${r.html_url}" target="_blank" rel="noopener noreferrer">GitHub</a>
						</div>
						<div class="accordion-body" style="max-height:none;">
							<div class="prose" style="padding:14px 16px 16px;">
								${rendered}
							</div>
						</div>
					</div>
				`;
			})
			.join("");
	}

	static render404(container) {
		container.innerHTML = `
			<section class="container page-shell page-enter">
				<div class="page-hero">
					<div class="eyebrow">404</div>
					<h1>Page not found.</h1>
					<p class="lead">Use the navigation to get back on track.</p>
				</div>
			</section>
		`;
	}
}

window.Pages = Pages;
