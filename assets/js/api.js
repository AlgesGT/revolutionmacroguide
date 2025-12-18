/**
 * GitHub API Integration (Public, unauthenticated)
 * Fetches releases and approved troubleshooting issues from GitHub.
 *
 * Improvements:
 * - Adds localStorage caching (so refreshes don't spam GitHub API)
 * - Falls back to stale cache on API failure (rate limits / outages)
 * - Still NO tokens, NO secrets, GET-only
 */

class GitHubAPI {
	constructor() {
		this.baseUrl = 'https://api.github.com';

		// In-memory cache (fast)
		this.cache = {};

		// Cache TTL in ms (10 minutes)
		this.cacheTime = 10 * 60 * 1000;

		// localStorage key prefix
		this.lsPrefix = 'revo_cache_v1::';
	}

	// ----------------------------
	// URL helpers
	// ----------------------------

	getReleasesUrl(owner = 'nosyliam', repo = 'revolution-macro') {
		return `${this.baseUrl}/repos/${owner}/${repo}/releases?per_page=10`;
	}

	getTroubleshootingIssuesUrl(
		owner = 'RevolutionGuides',
		repo = 'revolutionmacroguide',
		labels = 'approved'
	) {
		// GitHub accepts comma-separated labels in a single query param
		return `${this.baseUrl}/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(
			labels
		)}&per_page=50`;
	}

	// ----------------------------
	// Cache helpers
	// ----------------------------

	lsKey(url) {
		return `${this.lsPrefix}${url}`;
	}

	readLocalCache(url) {
		try {
			const raw = localStorage.getItem(this.lsKey(url));
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return null;
			return parsed;
		} catch {
			return null;
		}
	}

	writeLocalCache(url, data) {
		try {
			const payload = { data, timestamp: Date.now() };
			localStorage.setItem(this.lsKey(url), JSON.stringify(payload));
		} catch {
			// If storage is full or blocked, ignore silently.
		}
	}

	// ----------------------------
	// Fetch core
	// ----------------------------

	async fetchJson(url, useCache = true) {
		const cacheKey = url;

		// 1) In-memory cache
		if (useCache) {
			const cached = this.cache[cacheKey];
			if (cached && Date.now() - cached.timestamp < this.cacheTime) {
				return cached.data;
			}
		}

		// 2) localStorage cache
		let local = null;
		if (useCache) {
			local = this.readLocalCache(url);
			if (local && Date.now() - local.timestamp < this.cacheTime) {
				// hydrate memory cache
				this.cache[cacheKey] = local;
				return local.data;
			}
		}

		// 3) Network fetch
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Accept: 'application/vnd.github+json',
				},
			});

			if (!response.ok) {
				throw new Error(`API Error: ${response.status}`);
			}

			const data = await response.json();

			if (useCache) {
				const payload = { data, timestamp: Date.now() };
				this.cache[cacheKey] = payload;
				this.writeLocalCache(url, data);
			}

			return data;
		} catch (error) {
			console.error('GitHub API Error:', error);

			// 4) Fall back to stale local cache if it exists (even if expired)
			if (useCache && local && local.data) {
				return local.data;
			}

			return null;
		}
	}

	// ----------------------------
	// Public methods used by pages.js
	// ----------------------------

	async getReleases() {
		const url = this.getReleasesUrl();
		return await this.fetchJson(url, true);
	}

	/**
	 * Returns issues labeled with "approved" plus your category labels.
	 * Category filtering is done client-side in pages.js (chips).
	 *
	 * labels can be:
	 * - "approved" (default)
	 * - "approved,windows"
	 * - "approved,mac"
	 * - etc.
	 */
	async getTroubleshootingIssues(labels = 'approved') {
		const url = this.getTroubleshootingIssuesUrl(
			'RevolutionGuides',
			'revolutionmacroguide',
			labels
		);
		return await this.fetchJson(url, true);
	}

	// ----------------------------
	// Formatting helpers
	// ----------------------------

	formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	formatSize(bytes) {
		if (!bytes || bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}
}

const githubAPI = new GitHubAPI();
