// ==UserScript==
// @name         Highlight All Visited Links
// @namespace    http://tampermonkey.net/
// @version      2.7.2
// @description  Highlight visited links, store them persistently, validate links to exclude unwanted patterns, avoid duplicates, and provide options to backup or import link data as JSON.
// @author       Onii-chan ZS-ExE
// @match        *://*/*
// @exclude      /^[^:/#?]*:\/\/([^#?/]*\.)?(qccoccocmedia|sonar-cdn|google|facebook|youtube|fbsbx|googletagmanager|chatgpt|github|ssp\.api\.tappx|js\.adscale|dsp-service\.admatic|eus\.rubiconproject|sync\.adprime|rtb\.gumgum)\.[a-zA-Z0-9\-]{2,}(:[0-9]{1,5})?\/.*$/
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @downloadURL  https://github.com/fuongtraa/highlight-all-visited-links/raw/refs/heads/main/Highlight%20All%20Visited%20Links.user.js
// @updateURL    https://github.com/fuongtraa/highlight-all-visited-links/raw/refs/heads/main/Highlight%20All%20Visited%20Links.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const visitedLinksKey = "strictVisitedLinks";
    const visitedTitlesKey = "strictVisitedTitles";
    const visitedAltsKey = "strictVisitedAlts";
    const highlightEnabledKey = "highlightEnabled";

    let visitedLinks = GM_getValue(visitedLinksKey, []);
    let visitedTitles = GM_getValue(visitedTitlesKey, []);
    let visitedAlts = GM_getValue(visitedAltsKey, []);
    let isStyleEnabled = GM_getValue(highlightEnabledKey, true);

    const highlightStyle = `
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
    `;

    if (isStyleEnabled) {
        GM_addStyle(highlightStyle);
    }
    // Blacklist patterns for title and alt
    const blacklistKeywords = ['tập', 'Tập', 'episode', 'Episode', 'season', 'Season'];

    // Hàm lọc blacklist
    function filterBlacklist(dataArray) {
        return dataArray.filter(item => {
            return !blacklistKeywords.indexOf(keyword => item.toLowerCase().includes(keyword.toLowerCase()));
        });
    }

    // Cập nhật lại dữ liệu đã lưu trong storage để loại bỏ các mục trong blacklist
    function cleanStorage() {
        visitedTitles = filterBlacklist(visitedTitles);
        visitedAlts = filterBlacklist(visitedAlts);

        // Cập nhật lại giá trị đã lọc vào storage
        GM_setValue(visitedTitlesKey, visitedTitles);
        GM_setValue(visitedAltsKey, visitedAlts);
    }

    // Temporary storage for changes
    let tempVisitedLinks = [];
    let tempVisitedTitles = [];
    let tempVisitedAlts = [];

    // Delay in milliseconds to wait before saving changes
    const saveDelay = 10000;

    // Timeout for saving changes
    let saveTimeout;

    // Hàm phân tích URL, trích xuất domainName, path và fullPath
    function parseURL(url) {
        try {
            const parsed = new URL(url);
            // Lấy phần domain name (bỏ qua TLD)
            const hostnameParts = parsed.hostname.split('.');
            const domainName = hostnameParts.length > 2 ? hostnameParts.slice(-3, -2).join('.') : hostnameParts[0]; // Lấy toàn bộ domain trừ TLD
            const path = parsed.pathname;
            const query = parsed.search; // Lấy query parameters (nếu có)
            const fullPath = `${domainName}${path}${query}`;// Kết hợp domain, path và query để tạo fullPath
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

    // Kiểm tra alt và title có chứa từ khoá blacklist không
    function isBlacklisted(text) {
        return blacklistKeywords.some(keyword => text && text.includes(keyword));
    }

    // Lưu liên kết đã truy cập và loại bỏ trùng lặp
    function saveVisitedLink(url, title, alt) {
        const parsed = parseURL(url);
        if (parsed && isValidURL(url)) {
            const { fullPath } = parsed;

            // Kiểm tra nếu link đã tồn tại trong mảng tạm thời hoặc storage
            if (!tempVisitedLinks.includes(fullPath) && !visitedLinks.includes(fullPath)) {
                tempVisitedLinks.push(fullPath);
            }

            // Kiểm tra nếu title đã tồn tại trong mảng tạm thời hoặc storage
            if (title && !isBlacklisted(title) && !tempVisitedTitles.includes(title) && !visitedTitles.includes(title)) {
                tempVisitedTitles.push(title);
            }

            // Kiểm tra nếu alt đã tồn tại trong mảng tạm thời hoặc storage
            if (alt && !isBlacklisted(alt) && !tempVisitedAlts.includes(alt) && !visitedAlts.includes(alt)) {
                tempVisitedAlts.push(alt);
            }

            // Clear existing timeout and set a new one to save changes after the delay
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveChangesToStorage, saveDelay);
        }
    }

    // Save all accumulated changes to storage
    function saveChangesToStorage() {
        GM_setValue(visitedLinksKey, visitedLinks.concat(tempVisitedLinks));
        GM_setValue(visitedTitlesKey, visitedTitles.concat(tempVisitedTitles));
        GM_setValue(visitedAltsKey, visitedAlts.concat(tempVisitedAlts));

        // Clear temporary arrays after saving
        tempVisitedLinks = [];
        tempVisitedTitles = [];
        tempVisitedAlts = [];

        console.log("Visited links data saved successfully!");
    }

    // Highlight các liên kết đã truy cập
    function highlightVisitedLinks() {
        if (!isStyleEnabled) return;
        document.querySelectorAll('a').forEach(link => {
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
    // 🌟 Toggle Highlight Style
    function toggleStyle() {
        isStyleEnabled = !isStyleEnabled;
        GM_setValue(highlightEnabledKey, isStyleEnabled);

        if (isStyleEnabled) {
            GM_addStyle(highlightStyle);
            highlightVisitedLinks();
        } else {
            location.reload(); // OFF thì reload trang
        }

        // Cập nhật menu
        registerHighlightMenu();
    }

    // 🌟 Cập nhật menu lệnh
    function registerHighlightMenu() {
        GM_registerMenuCommand(
            isStyleEnabled ? "Highlight Style - ON" : "Highlight Style - OFF",
            toggleStyle
        );
    }

    // View stored data
    function viewStoredData() {
        let data = JSON.stringify({
            visitedLinks,
            visitedTitles,
            visitedAlts
        }, null, 2);

        let newData = prompt("Edit stored data (JSON format):", data);
        if (newData) {
            try {
                let parsedData = JSON.parse(newData);
                visitedLinks = parsedData.visitedLinks || [];
                visitedTitles = parsedData.visitedTitles || [];
                visitedAlts = parsedData.visitedAlts || [];

                GM_setValue(visitedLinksKey, visitedLinks);
                GM_setValue(visitedTitlesKey, visitedTitles);
                GM_setValue(visitedAltsKey, visitedAlts);

                alert("Data updated successfully!");
            } catch {
                alert("Invalid JSON format. Please try again.");
            }
        }
    }

    // Backup dữ liệu đã lưu
    function backupVisitedLinks() {
        const data = JSON.stringify({ visitedLinks, visitedTitles, visitedAlts }, null, 2);
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

                    if (
                        importedData &&
                        Array.isArray(importedData.visitedLinks) &&
                        Array.isArray(importedData.visitedTitles) &&
                        Array.isArray(importedData.visitedAlts)
                    ) {
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
    registerHighlightMenu();
    GM_registerMenuCommand('Backup Visited Links', backupVisitedLinks);
    GM_registerMenuCommand('Import Visited Links', importVisitedLinks);
    GM_registerMenuCommand('View Stored Data', viewStoredData);



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
        cleanStorage();
        highlightVisitedLinks();
    });

    // Khi trạng thái visibility của trang thay đổi, cập nhật lại danh sách liên kết
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            highlightVisitedLinks();
        }
    });
})();
