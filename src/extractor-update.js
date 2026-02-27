// ============================================================
// ServiceNow Extractor - Update Module
// Automatic and manual version checking against GitHub.
// Uses GM_xmlhttpRequest for cross-origin fetching.
// ============================================================
(function () {
    'use strict';

    const ns = window.SNExtractor;
    if (!ns) { console.error('[SN-Extractor] Config module not loaded'); return; }

    // CR-06: Reference ns.ICONS at call time, not at module load
    const { SK, Logger } = ns;

    // ── Semantic version comparison ────────────────────────────
    ns.isNewerVersion = function (latest, current) {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);
        const maxLen = Math.max(latestParts.length, currentParts.length);

        while (latestParts.length < maxLen) latestParts.push(0);
        while (currentParts.length < maxLen) currentParts.push(0);

        for (let i = 0; i < maxLen; i++) {
            if (latestParts[i] > currentParts[i]) return true;
            if (latestParts[i] < currentParts[i]) return false;
        }
        return false; // equal
    };

    // ── Check for updates ──────────────────────────────────────
    // showNoUpdate: if true, show a toast even when already current
    ns.checkForUpdates = function (showNoUpdate) {
        if (!ns.FEATURE_FLAGS.UPDATE_CHECKER) return;

        const lastCheck = GM_getValue(SK.VCHECK, 0);
        const now = Date.now();

        // Rate limit: skip if within interval (unless manual check)
        if (!showNoUpdate && (now - lastCheck) < ns.VERSION_CHECK_INTERVAL) {
            Logger.debug('Skipping version check (within interval)');
            return;
        }

        Logger.info('Checking for updates...');

        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: ns.GITHUB_VERSION_URL + '?t=' + now,
                onload: function (response) {
                    try {
                        GM_setValue(SK.VCHECK, now);

                        const match = response.responseText.match(/@version\s+([^\s]+)/);
                        if (!match) {
                            Logger.warn('Could not parse remote version');
                            if (showNoUpdate) {
                                ns.showToast('Could not parse remote version', 'error');
                            }
                            return;
                        }

                        const latestVersion = match[1].trim();
                        const skippedVersion = GM_getValue(SK.VSKIP, '');

                        Logger.debug(`Remote version: ${latestVersion}, Current: ${ns.VERSION}, Skipped: ${skippedVersion}`);

                        if (ns.isNewerVersion(latestVersion, ns.VERSION) && latestVersion !== skippedVersion) {
                            ns.showUpdateModal(latestVersion);
                        } else if (showNoUpdate) {
                            ns.showToast(
                                `You are on the latest version (${ns.VERSION})`,
                                'success'
                            );
                        }
                    } catch (parseErr) {
                        Logger.error('Version parse error:', parseErr);
                        if (showNoUpdate) {
                            ns.showToast('Version check failed', 'error');
                        }
                    }
                },
                onerror: function (err) {
                    Logger.error('Version check network error:', err);
                    if (showNoUpdate) {
                        ns.showToast('Failed to check for updates (network error)', 'error');
                    }
                }
            });
        } catch (outerErr) {
            Logger.error('Version check failed:', outerErr);
            if (showNoUpdate) {
                ns.showToast('Update check unavailable', 'error');
            }
        }
    };

    // ── Update notification modal ──────────────────────────────
    ns.showUpdateModal = function (latestVersion) {
        // Remove existing modal if present
        const existing = document.querySelector('.tm-modal-bg');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'tm-modal-bg';
        overlay.innerHTML =
            '<div class="tm-modal">' +
                '<h3>Update Available</h3>' +
                '<p>A new version of ServiceNow Extractor is available.</p>' +
                '<div class="tm-modal-ver">' +
                    '<span>Current: <strong>' + ns.VERSION + '</strong></span>' +
                    '<span>Latest: <strong>' + latestVersion + '</strong></span>' +
                '</div>' +
                '<div class="tm-modal-acts">' +
                    '<button class="tm-btn tm-btn-p tm-btn-f" id="tm-update-now">' +
                        ns.ICONS.download + ' Update Now' +
                    '</button>' +
                    '<button class="tm-btn tm-btn-s tm-btn-f" id="tm-remind-later">' +
                        ns.ICONS.refresh + ' Remind Later' +
                    '</button>' +
                    '<button class="tm-btn tm-btn-g tm-btn-f" id="tm-skip-version">' +
                        'Skip this version' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Update Now: open the raw script URL for Tampermonkey install
        document.getElementById('tm-update-now').addEventListener('click', function () {
            window.open(ns.GITHUB_VERSION_URL, '_blank');
            overlay.remove();
        });

        // Remind Later: reset the check timer so it fires again soon
        document.getElementById('tm-remind-later').addEventListener('click', function () {
            GM_setValue(SK.VCHECK, 0);
            overlay.remove();
            Logger.info('User chose "Remind Later"');
        });

        // Skip This Version: persist the version so we stop asking
        document.getElementById('tm-skip-version').addEventListener('click', function () {
            GM_setValue(SK.VSKIP, latestVersion);
            overlay.remove();
            Logger.info(`User skipped version ${latestVersion}`);
        });

        // Close on backdrop click
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
    };

    // ── Start periodic checking ────────────────────────────────
    // CR-15: Use recursive setTimeout instead of setInterval to avoid drift/stacking
    ns.startVersionChecking = function () {
        if (!ns.FEATURE_FLAGS.UPDATE_CHECKER) return;

        // Initial check after 5 second delay (non-intrusive)
        setTimeout(function () {
            ns.checkForUpdates(false);
        }, 5000);

        // Recursive scheduling - avoids setInterval drift on long-lived tabs
        function scheduleNext() {
            setTimeout(function () {
                ns.checkForUpdates(false);
                scheduleNext();
            }, ns.VERSION_CHECK_INTERVAL);
        }
        scheduleNext();

        Logger.info('Version checking initialized');
    };

    Logger.info('Update module loaded');

    // CR-16: Export for testing
    try { module.exports = { isNewerVersion: ns.isNewerVersion, checkForUpdates: ns.checkForUpdates, startVersionChecking: ns.startVersionChecking }; } catch (e) { /* browser */ }
})();
