document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTS ---
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const filters = document.getElementById('filters');
    const sortSelect = document.getElementById('sortSelect');
    const durationSelect = document.getElementById('durationSelect');
    const dateSelect = document.getElementById('dateSelect');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsStats = document.getElementById('resultsStats');

    // Library Specific Elements
    const libraryBtn = document.getElementById('libraryBtn');
    const savedCount = document.getElementById('savedCount');
    const libraryLayout = document.getElementById('libraryLayout');
    const libraryGrid = document.getElementById('libraryGrid');
    const playlistList = document.getElementById('playlistList');
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');
    const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
    const currentPlaylistTitle = document.getElementById('currentPlaylistTitle');

    // Modals & Other
    const helpBtn = document.getElementById('helpBtn');
    const videoModal = document.getElementById('videoModal');
    const modalClose = document.getElementById('modalClose');
    const videoFrame = document.getElementById('videoFrame');
    const modalTitle = document.getElementById('modalTitle');
    const modalSource = document.getElementById('modalSource');
    const watchExternal = document.getElementById('watchExternal');
    const helpModal = document.getElementById('helpModal');
    const helpClose = document.getElementById('helpClose');
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    // --- STATE ---
    let currentQuery = '';
    let isSearching = false;
    let viewMode = 'search'; // 'search' | 'library' | 'featured'
    let allFetchedResults = [];

    // Playlist State
    let playlists = loadPlaylists();
    let activePlaylistId = 'favorites';

    // Featured Topics
    const FEATURED_TOPICS = [
        'Space Exploration NASA', 'Underwater Wildlife 4K', 'Blender Open Movie',
        'Retro Computer History', 'Abstract Animation Art', 'Extreme Sports Red Bull',
        'Cooking Masterclass', 'Classical Music Live'
    ];

    // --- INITIALIZATION ---
    initializeTheme();
    updateSavedCount();
    setupVoiceSearch();
    loadFeaturedVideos();

    // --- EVENT LISTENERS ---
    searchBtn.addEventListener('click', () => performSearch(searchInput.value.trim()));
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(searchInput.value.trim()); });

    [sortSelect, durationSelect, dateSelect].forEach(select => {
        select.addEventListener('change', () => applyFiltersAndRender());
    });

    document.querySelectorAll('.filter-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const checkbox = e.currentTarget.querySelector('input');
            checkbox.checked ? e.currentTarget.classList.add('active') : e.currentTarget.classList.remove('active');
            if (currentQuery && viewMode === 'search') {
                clearTimeout(window.searchTimeout);
                window.searchTimeout = setTimeout(() => performSearch(currentQuery), 500);
            }
        });
    });

    libraryBtn.addEventListener('click', () => {
        viewMode = 'library';
        showLibraryInterface();
    });

    createPlaylistBtn.addEventListener('click', createNewPlaylist);
    deletePlaylistBtn.addEventListener('click', deleteCurrentPlaylist);

    helpBtn.addEventListener('click', () => { helpModal.classList.add('active'); document.body.style.overflow = 'hidden'; });
    helpClose.addEventListener('click', () => { helpModal.classList.remove('active'); document.body.style.overflow = ''; });

    // Modal Close Logic
    modalClose.addEventListener('click', closeVideoModal);
    videoModal.addEventListener('click', (e) => { if (e.target === videoModal) closeVideoModal(); });
    helpModal.addEventListener('click', (e) => { if (e.target === helpModal) { helpModal.classList.remove('active'); document.body.style.overflow = ''; } });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (videoModal.classList.contains('active')) closeVideoModal();
            if (helpModal.classList.contains('active')) { helpModal.classList.remove('active'); document.body.style.overflow = ''; }
        }
    });

    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const category = chip.dataset.category;
            searchInput.value = category;
            performSearch(category);
            chip.style.transform = 'scale(0.95)';
            setTimeout(() => chip.style.transform = '', 100);
        });
    });

    // --- PLAYLIST LOGIC ---
    function loadPlaylists() {
        const stored = localStorage.getItem('openvid_playlists');
        if (stored) return JSON.parse(stored);

        // Migration for old format (if any)
        const oldLibrary = JSON.parse(localStorage.getItem('openvid_library') || '[]');
        if (oldLibrary.length > 0) {
            localStorage.removeItem('openvid_library'); // Clean up old key
            const initial = [{ id: 'favorites', name: 'Favorites', videos: oldLibrary }];
            localStorage.setItem('openvid_playlists', JSON.stringify(initial));
            return initial;
        }

        return [{ id: 'favorites', name: 'Favorites', videos: [] }];
    }

    function savePlaylists() {
        localStorage.setItem('openvid_playlists', JSON.stringify(playlists));
        updateSavedCount();
    }

    function createNewPlaylist() {
        const name = prompt("Enter playlist name:");
        if (name && name.trim()) {
            const newId = 'pl_' + Date.now();
            playlists.push({ id: newId, name: name.trim(), videos: [] });
            savePlaylists();
            renderSidebar();
            switchPlaylist(newId);
        }
    }

    function deleteCurrentPlaylist() {
        if (activePlaylistId === 'favorites') return;
        if (confirm('Are you sure you want to delete this playlist?')) {
            playlists = playlists.filter(p => p.id !== activePlaylistId);
            savePlaylists();
            switchPlaylist('favorites');
        }
    }

    function switchPlaylist(id) {
        activePlaylistId = id;
        renderSidebar();
        renderLibraryContent();
    }

    function isVideoSaved(videoId) {
        // Check if saved in ANY playlist (for heart icon state)
        return playlists.some(pl => pl.videos.some(v => v.id === videoId));
    }

    function addToFavorites(video) {
        const fav = playlists.find(p => p.id === 'favorites');
        if (!fav.videos.some(v => v.id === video.id)) {
            fav.videos.push(video);
            savePlaylists();
        }
    }

    function removeFromAllPlaylists(videoId) {
        playlists.forEach(pl => {
            pl.videos = pl.videos.filter(v => v.id !== videoId);
        });
        savePlaylists();
    }

    function moveVideoToPlaylist(videoId, targetPlaylistId) {
        // Find video (might be in current playlist)
        let video = null;
        playlists.forEach(pl => {
            const v = pl.videos.find(x => x.id === videoId);
            if (v) video = v;
        });

        if (!video) return;

        // Remove from current
        const currentPl = playlists.find(p => p.id === activePlaylistId);
        currentPl.videos = currentPl.videos.filter(v => v.id !== videoId);

        // Add to target
        const targetPl = playlists.find(p => p.id === targetPlaylistId);
        if (!targetPl.videos.some(v => v.id === videoId)) {
            targetPl.videos.push(video);
        }

        savePlaylists();
        renderLibraryContent(); // Refresh view
    }

    // --- LIBRARY UI ---
    function showLibraryInterface() {
        // Hide Search/Results
        resultsSection.style.display = 'none';
        emptyState.style.display = 'none';
        loadingState.style.display = 'none';
        filters.style.display = 'none'; // Hide filters in library for simplicity

        // Show Library
        libraryLayout.style.display = 'grid';
        renderSidebar();
        renderLibraryContent();
    }

    function renderSidebar() {
        playlistList.innerHTML = '';
        playlists.forEach(pl => {
            const li = document.createElement('li');
            li.className = `playlist-item ${pl.id === activePlaylistId ? 'active' : ''}`;
            li.innerHTML = `
                <span>${pl.name}</span>
                <span class="playlist-count">${pl.videos.length}</span>
            `;
            li.onclick = () => switchPlaylist(pl.id);
            playlistList.appendChild(li);
        });
    }

    function renderLibraryContent() {
        const playlist = playlists.find(p => p.id === activePlaylistId);
        if (!playlist) return switchPlaylist('favorites');

        currentPlaylistTitle.textContent = playlist.name;
        deletePlaylistBtn.style.display = playlist.id === 'favorites' ? 'none' : 'block';

        libraryGrid.innerHTML = '';

        if (playlist.videos.length === 0) {
            libraryGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">
                    <p>This playlist is empty.</p>
                </div>
            `;
            return;
        }

        playlist.videos.forEach(video => {
            const card = createVideoCard(video, true); // true = library mode
            libraryGrid.appendChild(card);
        });
    }

    // --- STANDARD SEARCH VIEW ---
    async function performSearch(query, isFeatured = false) {
        if (!query) return;

        currentQuery = query;
        viewMode = isFeatured ? 'featured' : 'search';
        isSearching = true; // Use simple state, fetch is awaited

        // Reset View to Search Mode
        libraryLayout.style.display = 'none';
        resultsSection.style.display = 'block';
        filters.style.display = 'flex';
        loadingState.style.display = 'block';
        resultsGrid.innerHTML = '';
        emptyState.style.display = 'none';

        if (isFeatured) {
            resultsTitle.textContent = 'Trending Now';
            resultsStats.textContent = `Featured: ${query}`;
        } else {
            resultsTitle.textContent = `Results for "${query}"`;
            resultsStats.textContent = '';
        }

        const activeSources = Array.from(document.querySelectorAll('.filter-toggle.active')).map(t => t.dataset.source);
        if (activeSources.length === 0) {
            loadingState.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        try {
            const params = new URLSearchParams({
                q: query, sources: activeSources.join(','), sort: 'relevance', duration: 'all', date: 'all'
            });

            const response = await fetch(`/api/search?${params}`);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errText || response.statusText}`);
            }

            const data = await response.json();

            allFetchedResults = data.results || [];
            applyFiltersAndRender();

        } catch (error) {
            console.error('Search error:', error);
            resultsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--color-nasa); padding: 2rem;">
                    <h3>Unable to load videos</h3>
                    <p style="margin-bottom:0.5rem; font-family:monospace; background:rgba(0,0,0,0.2); display:inline-block; padding:0.5rem; border-radius:4px;">${error.message}</p>
                    <p><small>Check if the API service is running or try refreshing.</small></p>
                </div>
            `;
        } finally {
            loadingState.style.display = 'none';
        }
    }

    function applyFiltersAndRender() {
        if (viewMode === 'library') return; // Handled separately

        let filtered = [...allFetchedResults];
        const duration = durationSelect.value;
        const date = dateSelect.value;
        const sort = sortSelect.value;

        // 1. Duration
        if (duration !== 'all') {
            filtered = filtered.filter(item => {
                const sec = parseDurationToSeconds(item.duration);
                if (duration === 'short') return sec < 240;
                if (duration === 'medium') return sec >= 240 && sec <= 1200;
                if (duration === 'long') return sec > 1200;
                return true;
            });
        }

        // 2. Date
        if (date !== 'all') {
            const now = new Date();
            filtered = filtered.filter(item => {
                if (!item.publishedAt) return false;
                const days = Math.ceil(Math.abs(now - new Date(item.publishedAt)) / (86400000));
                if (date === 'today') return days <= 1;
                if (date === 'week') return days <= 7;
                if (date === 'month') return days <= 30;
                if (date === 'year') return days <= 365;
                return true;
            });
        }

        // 3. Sort
        if (sort === 'date') filtered.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        else if (sort === 'views') filtered.sort((a, b) => (b.views || 0) - (a.views || 0));

        renderSearchResults(filtered);
    }

    function renderSearchResults(results) {
        resultsGrid.innerHTML = '';
        if (results.length === 0) {
            resultsGrid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">No results found.</p>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        results.forEach(video => fragment.appendChild(createVideoCard(video, false)));
        resultsGrid.appendChild(fragment);

        const count = results.length;
        if (viewMode !== 'featured') resultsStats.textContent = `${count} video${count !== 1 ? 's' : ''} visible`;
    }

    function createVideoCard(video, isLibraryMode) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.onclick = (e) => {
            // Prevent opening modal if clicking dropdown actions
            if (e.target.closest('.card-actions-menu') || e.target.closest('.card-action')) return;
            openVideoModal(video);
        };

        const durationHtml = video.duration && video.duration !== 'N/A' ? `<span class="card-duration">${video.duration}</span>` : '';
        const thumbnail = video.thumbnail || `https://via.placeholder.com/640x360/000000/FFFFFF?text=${encodeURIComponent(video.sourceLabel)}`;
        const isSaved = isVideoSaved(video.id);

        // Logic for Actions
        let actionButtonHtml;
        if (isLibraryMode) {
            // In Library: Show Move Options
            // We'll use a simple "Move" text or icon that opens a prompt/alert for MVP simplicity
            // OR generate a select box. A select box is cleaner.
            const otherPlaylists = playlists.filter(p => p.id !== activePlaylistId);
            let moveOptions = otherPlaylists.map(p => `<option value="${p.id}">Move to ${p.name}</option>`).join('');

            actionButtonHtml = `
                <div class="card-actions-menu" onclick="event.stopPropagation()">
                    <select class="playlist-move-select" onchange="this.dispatchEvent(new CustomEvent('move-video', {bubbles: true, detail: {vid: '${video.id}', pid: this.value}}))">
                        <option value="">Move...</option>
                        ${moveOptions}
                    </select>
                    <button class="btn-remove-sm" data-id="${video.id}" title="Remove from playlist">✕</button>
                </div>
             `;
        } else {
            // In Search: Heart Toggle
            actionButtonHtml = `
                <button class="card-action ${isSaved ? 'active' : ''}" title="${isSaved ? 'Remove from favorites' : 'Add to favorites'}">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
            `;
        }

        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${thumbnail}" alt="${video.title}" loading="lazy" onerror="this.src='/images/placeholder.svg'">
                ${actionButtonHtml}
                <div class="card-source-badge source-${video.source}">${getSourceIcon(video.source)} ${video.sourceLabel}</div>
                ${durationHtml}
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${video.title}">${video.title}</h3>
                <div class="card-meta">
                    <span class="card-channel">${video.channelTitle}</span>
                    <span class="card-views">${formatNumber(video.views)}</span>
                </div>
            </div>
        `;

        // Attach Event Listeners
        if (isLibraryMode) {
            // Remove Button
            const removeBtn = card.querySelector('.btn-remove-sm');
            if (removeBtn) removeBtn.onclick = (e) => {
                e.stopPropagation();
                // Remove from THIS playlist
                const pl = playlists.find(p => p.id === activePlaylistId);
                pl.videos = pl.videos.filter(v => v.id !== video.id);
                savePlaylists();
                renderLibraryContent();
            };

            // Move Select
            const moveSelect = card.querySelector('.playlist-move-select');
            if (moveSelect) {
                moveSelect.addEventListener('move-video', (e) => {
                    moveVideoToPlaylist(e.detail.vid, e.detail.pid);
                });
            }
        } else {
            // Search Mode Heart
            const heartBtn = card.querySelector('.card-action');
            heartBtn.onclick = (e) => {
                e.stopPropagation();
                if (isSaved) {
                    removeFromAllPlaylists(video.id);
                    heartBtn.classList.remove('active');
                } else {
                    addToFavorites(video);
                    heartBtn.classList.add('active');
                    // Simple animation
                    heartBtn.style.transform = 'scale(1.2)';
                    setTimeout(() => heartBtn.style.transform = '', 200);
                }
                updateSavedCount();
            };
        }

        return card;
    }

    // --- SHARED HELPERS ---
    function updateSavedCount() {
        const total = playlists.reduce((acc, pl) => acc + pl.videos.length, 0);
        savedCount.textContent = total;
        savedCount.style.display = total > 0 ? 'inline-flex' : 'none';

        // Also update saved list for search visual state
        // (We don't need a separate list, isVideoSaved checks playlists)
    }

    // ... (Existing Helpers: getSourceIcon, formatNumber, modal logic, theme icons etc)
    function getSourceIcon(source) {
        switch (source) {
            case 'dailymotion': return '▶'; case 'peertube': return '◉'; case 'archive': return '📚'; case 'wikimedia': return 'W'; case 'nasa': return '🚀'; default: return '●';
        }
    }
    function formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    function parseDurationToSeconds(durationStr) {
        if (!durationStr || durationStr === 'N/A') return 0;
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    }

    function initializeTheme() {
        if (localStorage.getItem('openvid_theme') === 'light') {
            document.body.classList.add('light-theme');
            updateThemeIcons(true);
        }
        themeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('openvid_theme', isLight ? 'light' : 'dark');
            updateThemeIcons(isLight);
        });
    }

    function updateThemeIcons(isLight) {
        isLight ? (sunIcon.style.display = 'none', moonIcon.style.display = 'block') : (sunIcon.style.display = 'block', moonIcon.style.display = 'none');
    }

    function setupVoiceSearch() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { voiceBtn.style.display = 'none'; return; }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
        voiceBtn.addEventListener('click', () => { voiceBtn.classList.contains('listening') ? recognition.stop() : (recognition.start(), voiceBtn.classList.add('listening'), searchInput.placeholder = 'Listening...') });
        recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; performSearch(searchInput.value); };
        recognition.onend = () => { voiceBtn.classList.remove('listening'); searchInput.placeholder = 'Search for videos...'; };
    }

    function loadFeaturedVideos() {
        const topic = FEATURED_TOPICS[Math.floor(Math.random() * FEATURED_TOPICS.length)];
        viewMode = 'featured';
        performSearch(topic, true);
    }

    // Modal Logic
    function openVideoModal(video) {
        modalTitle.textContent = video.title; modalSource.textContent = `Source: ${video.sourceLabel}`; modalSource.className = `modal-source source-${video.source}`; watchExternal.href = video.watchUrl;
        videoFrame.src = ''; videoFrame.style.display = 'block';
        const existing = document.querySelector('.modal-body video'); if (existing) existing.remove();

        if (video.isDirectFile) {
            videoFrame.style.display = 'none';
            const vid = document.createElement('video'); vid.controls = true; vid.autoplay = true; vid.style.width = '100%'; vid.style.height = '100%'; vid.style.background = '#000'; vid.src = video.embedUrl;
            document.querySelector('.video-wrapper').appendChild(vid);
        } else {
            videoFrame.src = video.embedUrl + (video.embedUrl.includes('?') ? '&autoplay=1' : '?autoplay=1');
        }
        videoModal.classList.add('active'); document.body.style.overflow = 'hidden';
    }
    function closeVideoModal() {
        videoModal.classList.remove('active'); videoFrame.src = '';
        const existing = document.querySelector('.modal-body video'); if (existing) existing.remove();
        document.body.style.overflow = '';
    }
});
