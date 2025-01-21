// ==UserScript==
// @name         Highlight All Visited Links (v2.7)
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  Highlight visited links, store them persistently, validate links to exclude unwanted patterns, avoid duplicates, and provide options to backup or import link data as JSON.
// @author       Onii
// @match        *://*/*
// @exclude      /^[^:/#?]*:\/\/([^#?/]*\.)?(sonar-cdn|google|facebook|youtube|fbsbx|googletagmanager)\.[a-zA-Z0-9\-]{2,}(:[0-9]{1,5})?\/.*$/
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const visitedLinksKey = "strictVisitedLinks";
    const visitedTitlesKey = "strictVisitedTitles";
    const visitedAltsKey = "strictVisitedAlts";

    let visitedLinks = GM_getValue(visitedLinksKey, []);
    let visitedTitles = GM_getValue(visitedTitlesKey, []);
    let visitedAlts = GM_getValue(visitedAltsKey, []);

    // CSS để highlight các liên kết đã truy cập
    GM_addStyle(`
        a.similar-visited {
            color: red !important;
            font-weight: bold !important;
            text-decoration: underline !important;
            text-decoration-color: yellow !important;
        }
        a.similar-visited * {
    color: red !important; /* Áp dụng cho tất cả phần tử con bên trong a */
    font-weight: bold !important; /* Áp dụng cho phần tử con */
    text-decoration: underline !important;
            text-decoration-color: yellow !important;
}
    `);

    // Hàm phân tích URL, trích xuất domainName, path và fullPath
  function parseURL(url) {
    try {
        const parsed = new URL(url);
        const hostnameParts = parsed.hostname.split('.');

        // Lấy phần domain name (bỏ qua TLD)
        const domainName = hostnameParts.slice(0, -1).join('.'); // Lấy toàn bộ domain trừ TLD

        const path = parsed.pathname;
        const query = parsed.search; // Lấy query parameters (nếu có)

        // Kết hợp domain, path và query để tạo fullPath
        const fullPath = `${domainName}${path}${query}`;

        return { domainName, path, fullPath, query };
    } catch {
        return null; // URL không hợp lệ
    }
}


    // Kiểm tra tính hợp lệ của URL
    function isValidURL(url) {
        const invalidPatterns = [
            /ads?[-_.]/i, /banners?[-_.]/i, /pop[-_.]?ups?/i,
            /track[-_.]?/i, /metrics[-_.]?/i, /affiliate[-_.]?/i,
            /analytics[-_.]?/i, /\.(doubleclick\.net|googleads\.g\.doubleclick\.net|googlesyndication\.com)/i
        ];
        return !invalidPatterns.some(pattern => pattern.test(url));
    }

    // Lưu liên kết đã truy cập và loại bỏ trùng lặp
    function saveVisitedLink(url, title, alt) {
        const parsed = parseURL(url);
        if (parsed && isValidURL(url)) {
            const { fullPath } = parsed;

            // Cập nhật chỉ khi có sự thay đổi
            let shouldUpdateLinks = false;
            let shouldUpdateTitles = false;
            let shouldUpdateAlts = false;

            // Kiểm tra và lưu trữ liên kết nếu chưa có
            if (!visitedLinks.includes(fullPath)) {
                visitedLinks.push(fullPath);
                shouldUpdateLinks = true;
            }

            // Kiểm tra và lưu trữ title nếu chưa có
            if (title && !visitedTitles.includes(title)) {
                visitedTitles.push(title);
                shouldUpdateTitles = true;
            }

            // Kiểm tra và lưu trữ alt nếu chưa có
            if (alt && !visitedAlts.includes(alt)) {
                visitedAlts.push(alt);
                shouldUpdateAlts = true;
            }

            // Chỉ cập nhật storage nếu có sự thay đổi
            if (shouldUpdateLinks) {
                GM_setValue(visitedLinksKey, visitedLinks);
            }
            if (shouldUpdateTitles) {
                GM_setValue(visitedTitlesKey, visitedTitles);
            }
            if (shouldUpdateAlts) {
                GM_setValue(visitedAltsKey, visitedAlts);
            }
        }
    }

    // Highlight các liên kết đã truy cập
    function highlightVisitedLinks() {
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            const parsed = parseURL(link.href);
            if (parsed) {
                const { fullPath } = parsed;
                const alt = link.querySelector('img')?.getAttribute('alt'); // Lấy `alt` từ thẻ img bên trong
                const title = link.title;

                // Nếu URL, title, hoặc alt trùng khớp với dữ liệu đã lưu
                if (
                    visitedLinks.includes(fullPath) ||
                    visitedTitles.some(storedTitle => title && title.includes(storedTitle)) ||
                    (alt && visitedAlts.includes(alt))
                ) {
                    link.classList.add('similar-visited');
                }
            }
        });
    }

    // Backup dữ liệu đã lưu
    function backupVisitedLinks() {
        const data = JSON.stringify({
            visitedLinks,
            visitedTitles,
            visitedAlts
        }, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `visited-links-backup-${timestamp}.json`;
        GM_download({ url: `data:application/json;charset=utf-8,${encodeURIComponent(data)}`, name: filename });
        alert('Backup completed! File has been downloaded.');
    }

    // Import dữ liệu từ file JSON
    function importVisitedLinks() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = event => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (importedData && Array.isArray(importedData.visitedLinks)) {
                        // Merge các dữ liệu đã import vào dữ liệu hiện tại
                        visitedLinks = [...new Set([...visitedLinks, ...importedData.visitedLinks])];
                        visitedTitles = [...new Set([...visitedTitles, ...importedData.visitedTitles])];
                        visitedAlts = [...new Set([...visitedAlts, ...importedData.visitedAlts])];

                        GM_setValue(visitedLinksKey, visitedLinks);
                        GM_setValue(visitedTitlesKey, visitedTitles);
                        GM_setValue(visitedAltsKey, visitedAlts);

                        alert('Import completed! Links have been updated.');
                    } else {
                        alert('Invalid file format. Please upload a valid JSON file.');
                    }
                } catch (error) {
                    alert('Error parsing the file. Please check the file content.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // Đăng ký menu lệnh
    GM_registerMenuCommand('Backup Visited Links', backupVisitedLinks);
    GM_registerMenuCommand('Import Visited Links', importVisitedLinks);

    // Lưu liên kết khi người dùng nhấp chuột (Left hoặc Middle Click)
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (link) {
            const alt = link.querySelector('img')?.getAttribute('alt'); // Lấy `alt` từ thẻ img bên trong
            const title = link.title;
            if (event.button === 0 || event.button === 1) { // Left Click or Middle Click
                saveVisitedLink(link.href, title, alt); // Lưu liên kết đã truy cập cùng với alt (nếu có)
            }
        }
    });

    // Lưu liên kết khi trang được tải và highlight tất cả các liên kết đã truy cập
    window.addEventListener('load', () => {
        saveVisitedLink(window.location.href);
        highlightVisitedLinks();
    });

    // Khi trạng thái visibility của trang thay đổi, cập nhật lại danh sách liên kết
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            visitedLinks = GM_getValue(visitedLinksKey, []);
            visitedTitles = GM_getValue(visitedTitlesKey, []);
            visitedAlts = GM_getValue(visitedAltsKey, []);
            highlightVisitedLinks();
        }
    });
})();
