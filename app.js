/**
 * YT Tracker - YouTube Video Tracker App
 * Nutzt RSS Feeds - KEIN API Key erforderlich!
 */

// ===========================
// Configuration
// ===========================
const CONFIG = {
    // CORS Proxies für RSS Feed Abruf (in Reihenfolge der Zuverlässigkeit)
    CORS_PROXIES: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest='
    ],
    // YouTube RSS Feed URL Template
    RSS_FEED_URL: 'https://www.youtube.com/feeds/videos.xml?channel_id=',
    // Piped API Instanzen für Kanal-Suche (kein API Key nötig)
    PIPED_INSTANCES: [
        'https://api.piped.private.coffee',
        'https://pipedapi.darkness.services',
        'https://pipedapi.ducks.party',
        'https://piped-api.privacy.com.de',
        'https://pipedapi.reallyaweso.me'
    ]
};

// ===========================
// Storage Keys
// ===========================
const STORAGE_KEYS = {
    CHANNELS: 'yt_tracker_channels',
    SEEN_VIDEOS: 'yt_tracker_seen_videos',
    VIDEOS_CACHE: 'yt_tracker_videos_cache',
    START_DATE: 'yt_tracker_start_date',
    VIEW_MODE: 'yt_tracker_view_mode'
};

// ===========================
// State
// ===========================
let state = {
    channels: [], // { id, handle, name, thumbnail }
    seenVideos: new Set(),
    videos: [],
    editingChannelId: null,
    currentPipedInstance: 0,
    startDate: null, // Filter: nur Videos ab diesem Datum anzeigen
    viewMode: 'videos', // 'videos' or 'channels'
    filteredChannelId: null // When viewing videos of a specific channel
};

// ===========================
// DOM Elements
// ===========================
const DOM = {
    // Sidebar
    menuBtn: document.getElementById('menuBtn'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    closeSidebarBtn: document.getElementById('closeSidebar'),
    
    // Channels
    channelList: document.getElementById('channelList'),
    addChannelBtn: document.getElementById('addChannelBtn'),
    
    // Videos
    mainContent: document.getElementById('mainContent'),
    videoGrid: document.getElementById('videoGrid'),
    channelGrid: document.getElementById('channelGrid'),
    videoCount: document.getElementById('videoCount'),
    viewTitle: document.getElementById('viewTitle'),
    viewToggleBtn: document.getElementById('viewToggleBtn'),
    viewIcon: document.getElementById('viewIcon'),
    refreshBtn: document.getElementById('refreshBtn'),
    markAllSeenBtn: document.getElementById('markAllSeenBtn'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    pullIndicator: document.getElementById('pullIndicator'),
    
    // Filter Modal
    filterBtn: document.getElementById('filterBtn'),
    filterModal: document.getElementById('filterModal'),
    filterModalClose: document.querySelector('.filter-modal-close'),
    startDateInput: document.getElementById('startDate'),
    resetToTodayBtn: document.getElementById('resetToToday'),
    clearDateFilterBtn: document.getElementById('clearDateFilter'),
    filterInfo: document.getElementById('filterInfo'),
    
    // Channel Modal
    channelModal: document.getElementById('channelModal'),
    modalTitle: document.getElementById('modalTitle'),
    channelInput: document.getElementById('channelInput'),
    saveChannelBtn: document.getElementById('saveChannel'),
    cancelChannelBtn: document.getElementById('cancelChannel'),
    modalClose: document.querySelector('.modal-close'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer')
};

// ===========================
// Initialization
// ===========================
function init() {
    loadState();
    setupEventListeners();
    renderChannels();
    updateView(); // This will render the correct view based on state.viewMode
    
    // Update missing thumbnails in background
    updateMissingThumbnails();
}

function loadState() {
    // Load Channels
    const channelsJson = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    state.channels = channelsJson ? JSON.parse(channelsJson) : [];
    
    // Load Seen Videos
    const seenJson = localStorage.getItem(STORAGE_KEYS.SEEN_VIDEOS);
    state.seenVideos = new Set(seenJson ? JSON.parse(seenJson) : []);
    
    // Load Cached Videos
    const videosJson = localStorage.getItem(STORAGE_KEYS.VIDEOS_CACHE);
    state.videos = videosJson ? JSON.parse(videosJson) : [];
    
    // Load Start Date Filter
    const startDate = localStorage.getItem(STORAGE_KEYS.START_DATE);
    state.startDate = startDate || null;
    
    // Update UI with loaded date
    if (state.startDate && DOM.startDateInput) {
        DOM.startDateInput.value = state.startDate;
    }
    updateFilterInfo();
    
    // Load View Mode
    const savedViewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
    if (savedViewMode === 'channels' || savedViewMode === 'videos') {
        state.viewMode = savedViewMode;
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(state.channels));
    localStorage.setItem(STORAGE_KEYS.SEEN_VIDEOS, JSON.stringify([...state.seenVideos]));
    localStorage.setItem(STORAGE_KEYS.VIDEOS_CACHE, JSON.stringify(state.videos));
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, state.viewMode);
}

// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    // Sidebar
    DOM.menuBtn.addEventListener('click', openSidebar);
    DOM.closeSidebarBtn.addEventListener('click', closeSidebar);
    DOM.sidebarOverlay.addEventListener('click', closeSidebar);
    
    // Channels
    DOM.addChannelBtn.addEventListener('click', () => {
        closeSidebar();
        openChannelModal();
    });
    
    // Videos
    DOM.refreshBtn.addEventListener('click', refreshVideos);
    DOM.markAllSeenBtn.addEventListener('click', markAllAsSeen);
    DOM.viewToggleBtn.addEventListener('click', toggleViewMode);
    
    // Filter Modal
    DOM.filterBtn.addEventListener('click', openFilterModal);
    DOM.filterModalClose.addEventListener('click', closeFilterModal);
    DOM.startDateInput.addEventListener('change', handleDateChange);
    DOM.resetToTodayBtn.addEventListener('click', resetToToday);
    DOM.clearDateFilterBtn.addEventListener('click', clearDateFilter);
    
    // Channel Modal
    DOM.saveChannelBtn.addEventListener('click', saveChannel);
    DOM.cancelChannelBtn.addEventListener('click', closeChannelModal);
    DOM.modalClose.addEventListener('click', closeChannelModal);
    DOM.channelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveChannel();
    });
    
    // Close modals on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!DOM.channelModal.classList.contains('hidden')) closeChannelModal();
            if (!DOM.filterModal.classList.contains('hidden')) closeFilterModal();
            if (!DOM.sidebar.classList.contains('hidden')) closeSidebar();
        }
    });
    
    // Close filter modal on backdrop click
    DOM.filterModal.querySelector('.modal-backdrop').addEventListener('click', closeFilterModal);
    DOM.channelModal.querySelector('.modal-backdrop').addEventListener('click', closeChannelModal);
    
    // Pull to Refresh (touch devices)
    setupPullToRefresh();
}

// ===========================
// Pull to Refresh
// ===========================
function setupPullToRefresh() {
    let startY = 0;
    let isPulling = false;
    
    DOM.mainContent.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
            isPulling = true;
        }
    }, { passive: true });
    
    DOM.mainContent.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        
        const y = e.touches[0].pageY;
        const diff = y - startY;
        
        if (diff > 0 && diff < 150 && window.scrollY === 0) {
            DOM.pullIndicator.classList.add('visible');
        }
    }, { passive: true });
    
    DOM.mainContent.addEventListener('touchend', async () => {
        if (DOM.pullIndicator.classList.contains('visible')) {
            DOM.pullIndicator.classList.add('loading');
            await refreshVideos();
            DOM.pullIndicator.classList.remove('loading');
            DOM.pullIndicator.classList.remove('visible');
        }
        isPulling = false;
    }, { passive: true });
}

// ===========================
// Sidebar Functions
// ===========================
function openSidebar() {
    DOM.sidebar.classList.remove('hidden');
    DOM.sidebarOverlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        DOM.sidebar.classList.add('visible');
        DOM.sidebarOverlay.classList.add('visible');
    });
}

function closeSidebar() {
    DOM.sidebar.classList.remove('visible');
    DOM.sidebarOverlay.classList.remove('visible');
    setTimeout(() => {
        DOM.sidebar.classList.add('hidden');
        DOM.sidebarOverlay.classList.add('hidden');
    }, 200);
}

// ===========================
// Filter Modal Functions
// ===========================
function openFilterModal() {
    DOM.filterModal.classList.remove('hidden');
}

function closeFilterModal() {
    DOM.filterModal.classList.add('hidden');
}

// ===========================
// View Toggle Functions
// ===========================
function toggleViewMode() {
    // If we're viewing a filtered channel's videos, go back to channel view
    if (state.filteredChannelId) {
        state.filteredChannelId = null;
        state.viewMode = 'channels';
        saveState();
        updateView();
        return;
    }
    
    // Toggle between views
    state.viewMode = state.viewMode === 'videos' ? 'channels' : 'videos';
    saveState();
    updateView();
}

function updateView() {
    const isChannelView = state.viewMode === 'channels' && !state.filteredChannelId;
    
    // Update title
    if (state.filteredChannelId) {
        DOM.viewTitle.textContent = 'Videos';
    } else {
        DOM.viewTitle.textContent = isChannelView ? 'Kanäle' : 'Neue Videos';
    }
    
    // Update toggle button icon and title
    if (state.filteredChannelId) {
        // Show back arrow when viewing channel videos
        DOM.viewIcon.innerHTML = `
            <polyline points="15 18 9 12 15 6"/>
        `;
        DOM.viewToggleBtn.classList.remove('active');
        DOM.viewToggleBtn.title = 'Zurück zu Kanälen';
    } else if (isChannelView) {
        // Show list/video icon when in channel view
        DOM.viewIcon.innerHTML = `
            <rect x="3" y="3" width="18" height="4" rx="1"/>
            <rect x="3" y="9" width="18" height="4" rx="1"/>
            <rect x="3" y="15" width="18" height="4" rx="1"/>
        `;
        DOM.viewToggleBtn.classList.remove('active');
        DOM.viewToggleBtn.title = 'Video-Ansicht';
    } else {
        // Show grid icon when in video view
        DOM.viewIcon.innerHTML = `
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
        `;
        DOM.viewToggleBtn.classList.remove('active');
        DOM.viewToggleBtn.title = 'Kanal-Ansicht';
    }
    
    // Show/hide grids
    if (isChannelView) {
        DOM.videoGrid.classList.add('hidden');
        DOM.channelGrid.classList.remove('hidden');
        renderChannelGrid();
    } else {
        DOM.videoGrid.classList.remove('hidden');
        DOM.channelGrid.classList.add('hidden');
        renderVideos();
    }
}

function renderChannelGrid() {
    // Get unseen videos per channel
    const unseenByChannel = {};
    
    state.videos.forEach(video => {
        if (state.seenVideos.has(video.id)) return;
        
        // Apply date filter
        if (state.startDate) {
            const videoDate = new Date(video.publishedAt).getTime();
            const startDateTime = new Date(state.startDate).getTime();
            if (videoDate < startDateTime) return;
        }
        
        if (!unseenByChannel[video.channelId]) {
            unseenByChannel[video.channelId] = 0;
        }
        unseenByChannel[video.channelId]++;
    });
    
    // Filter channels that have unseen videos
    const channelsWithVideos = state.channels.filter(c => unseenByChannel[c.id] > 0);
    
    // Update count
    const totalUnseen = Object.values(unseenByChannel).reduce((a, b) => a + b, 0);
    DOM.videoCount.textContent = totalUnseen;
    
    if (channelsWithVideos.length === 0) {
        DOM.channelGrid.innerHTML = '';
        DOM.emptyState.classList.remove('hidden');
        DOM.emptyState.querySelector('p').textContent = 'Keine neuen Videos';
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    
    DOM.channelGrid.innerHTML = channelsWithVideos.map((channel, index) => {
        const count = unseenByChannel[channel.id] || 0;
        const initial = channel.name.charAt(0).toUpperCase();
        
        // Only use the actual channel thumbnail (no video thumbnail fallback)
        const thumbnail = channel.thumbnail;
        
        return `
            <div class="channel-grid-item" onclick="showChannelVideos('${channel.id}')" style="animation-delay: ${index * 50}ms">
                <div class="channel-grid-avatar">
                    ${thumbnail 
                        ? `<img src="${thumbnail}" alt="${escapeHtml(channel.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="avatar-placeholder" style="display:none">${initial}</div>`
                        : `<div class="avatar-placeholder">${initial}</div>`
                    }
                    <span class="channel-grid-badge">${count}</span>
                </div>
                <span class="channel-grid-name">${escapeHtml(channel.name)}</span>
            </div>
        `;
    }).join('');
}

function showChannelVideos(channelId) {
    state.filteredChannelId = channelId;
    state.viewMode = 'videos'; // Switch to video view but filtered
    updateView();
}

function goBackToChannels() {
    state.filteredChannelId = null;
    state.viewMode = 'channels';
    saveState();
    updateView();
}

// ===========================
// Date Filter Functions
// ===========================
function handleDateChange() {
    const dateValue = DOM.startDateInput.value;
    state.startDate = dateValue || null;
    
    if (state.startDate) {
        localStorage.setItem(STORAGE_KEYS.START_DATE, state.startDate);
    } else {
        localStorage.removeItem(STORAGE_KEYS.START_DATE);
    }
    
    updateFilterInfo();
    renderVideos();
}

function resetToToday() {
    const today = new Date().toISOString().split('T')[0];
    DOM.startDateInput.value = today;
    state.startDate = today;
    localStorage.setItem(STORAGE_KEYS.START_DATE, today);
    
    updateFilterInfo();
    renderVideos();
    showToast('Filter: Nur Videos ab heute', 'success');
}

function clearDateFilter() {
    DOM.startDateInput.value = '';
    state.startDate = null;
    localStorage.removeItem(STORAGE_KEYS.START_DATE);
    
    updateFilterInfo();
    renderVideos();
    showToast('Datumsfilter entfernt', 'success');
}

function updateFilterInfo() {
    if (!DOM.filterInfo) return;
    
    if (state.startDate) {
        const date = new Date(state.startDate);
        const formatted = date.toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        DOM.filterInfo.textContent = `Zeige Videos ab ${formatted}`;
        DOM.filterInfo.classList.add('active');
    } else {
        DOM.filterInfo.textContent = 'Alle Videos werden angezeigt';
        DOM.filterInfo.classList.remove('active');
    }
}

// ===========================
// Channel Functions
// ===========================
function openChannelModal(channelId = null) {
    state.editingChannelId = channelId;
    
    if (channelId) {
        const channel = state.channels.find(c => c.id === channelId);
        if (channel) {
            DOM.modalTitle.textContent = 'Kanal bearbeiten';
            DOM.channelInput.value = channel.handle;
        }
    } else {
        DOM.modalTitle.textContent = 'Kanal hinzufügen';
        DOM.channelInput.value = '';
    }
    
    DOM.channelModal.classList.remove('hidden');
    setTimeout(() => DOM.channelInput.focus(), 100);
}

function closeChannelModal() {
    DOM.channelModal.classList.add('hidden');
    state.editingChannelId = null;
    DOM.channelInput.value = '';
}

async function saveChannel() {
    const input = DOM.channelInput.value.trim();
    if (!input) {
        showToast('Bitte gib einen Kanal-Handle oder URL ein', 'error');
        return;
    }
    
    // Extract handle from URL or use as-is
    let handle = extractHandle(input);
    
    try {
        showToast('Kanal wird gesucht...', 'warning');
        
        // Fetch channel info using Piped API
        const channelInfo = await fetchChannelInfo(handle);
        
        if (!channelInfo) {
            showToast('Kanal nicht gefunden - tippe für Hilfe', 'error');
            setTimeout(() => showChannelIdHelp(), 1000);
            return;
        }
        
        // Check if already exists
        const existingIndex = state.channels.findIndex(c => c.id === channelInfo.id);
        
        if (state.editingChannelId) {
            // Update existing
            const index = state.channels.findIndex(c => c.id === state.editingChannelId);
            if (index !== -1) {
                state.channels[index] = channelInfo;
            }
        } else if (existingIndex === -1) {
            // Add new
            state.channels.push(channelInfo);
        } else {
            showToast('Dieser Kanal existiert bereits', 'warning');
            closeChannelModal();
            return;
        }
        
        saveState();
        renderChannels();
        closeChannelModal();
        showToast(`${channelInfo.name} hinzugefügt`, 'success');
        
    } catch (error) {
        console.error('Error saving channel:', error);
        showToast('Fehler beim Speichern des Kanals. Versuche es erneut.', 'error');
    }
}

function extractHandle(input) {
    // Handle various URL formats
    const patterns = [
        /youtube\.com\/@([^\/\?]+)/,
        /youtube\.com\/channel\/([^\/\?]+)/,
        /youtube\.com\/c\/([^\/\?]+)/,
        /youtube\.com\/user\/([^\/\?]+)/,
        /@([^\/\?\s]+)/
    ];
    
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    // Return as-is if no pattern matched
    return input.replace('@', '');
}

// Fetch channel info - tries multiple methods
async function fetchChannelInfo(handle) {
    // Method 1: If it's already a channel ID (UC + 22 chars = 24 total), use it directly
    if (handle.startsWith('UC') && handle.length === 24) {
        // Try to get channel info from Piped API first (includes thumbnail)
        const thumbnail = await fetchChannelThumbnail(handle);
        
        // Try to get the channel name from RSS feed
        let channelName = handle;
        try {
            const rssUrl = CONFIG.RSS_FEED_URL + handle;
            for (const proxy of CONFIG.CORS_PROXIES) {
                try {
                    const response = await fetch(proxy + encodeURIComponent(rssUrl));
                    if (response.ok) {
                        const xml = await response.text();
                        const nameMatch = xml.match(/<author><name>([^<]+)<\/name>/);
                        if (nameMatch) {
                            channelName = nameMatch[1];
                        }
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            console.warn('Could not fetch channel name from RSS');
        }
        
        return {
            id: handle,
            handle: handle,
            name: channelName,
            thumbnail: thumbnail || ''
        };
    }
    
    // Method 2: Try Piped API first (most reliable for channel lookup)
    for (let i = 0; i < CONFIG.PIPED_INSTANCES.length; i++) {
        const instance = CONFIG.PIPED_INSTANCES[(state.currentPipedInstance + i) % CONFIG.PIPED_INSTANCES.length];
        
        try {
            // Try direct channel lookup by handle
            const channelUrl = `${instance}/c/${handle}`;
            const channelResponse = await fetch(channelUrl);
            
            if (channelResponse.ok) {
                const channelData = await channelResponse.json();
                if (channelData.id) {
                    state.currentPipedInstance = (state.currentPipedInstance + i) % CONFIG.PIPED_INSTANCES.length;
                    return {
                        id: channelData.id,
                        handle: handle,
                        name: channelData.name || handle,
                        thumbnail: channelData.avatarUrl || ''
                    };
                }
            }
            
            // Try search as fallback
            const searchUrl = `${instance}/search?q=${encodeURIComponent(handle)}&filter=channels`;
            const searchResponse = await fetch(searchUrl);
            
            if (!searchResponse.ok) continue;
            
            const searchData = await searchResponse.json();
            
            if (searchData.items && searchData.items.length > 0) {
                // Find the exact match by comparing handles
                const exactMatch = searchData.items.find(ch => {
                    const chName = ch.name?.toLowerCase() || '';
                    const searchHandle = handle.toLowerCase();
                    return chName === searchHandle || chName.includes(searchHandle);
                });
                
                const channel = exactMatch || searchData.items[0];
                const channelId = channel.url?.replace('/channel/', '') || '';
                
                if (channelId) {
                    state.currentPipedInstance = (state.currentPipedInstance + i) % CONFIG.PIPED_INSTANCES.length;
                    return {
                        id: channelId,
                        handle: handle,
                        name: channel.name,
                        thumbnail: channel.thumbnail || ''
                    };
                }
            }
        } catch (error) {
            console.warn(`Piped instance ${instance} failed:`, error);
            continue;
        }
    }
    
    // Method 3: Try to get channel ID from YouTube page via CORS proxy (fallback)
    try {
        const channelPageUrl = `https://www.youtube.com/@${handle}`;
        
        for (const proxy of CONFIG.CORS_PROXIES) {
            try {
                const response = await fetch(proxy + encodeURIComponent(channelPageUrl));
                if (!response.ok) continue;
                
                const html = await response.text();
                
                // Look for the canonical channel ID in the page metadata
                // This pattern specifically looks for the channel's own ID, not related channels
                const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})">/);
                if (canonicalMatch) {
                    const channelId = canonicalMatch[1];
                    const nameMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
                    const channelName = nameMatch ? nameMatch[1] : handle;
                    
                    return {
                        id: channelId,
                        handle: handle,
                        name: channelName,
                        thumbnail: ''
                    };
                }
                
                // Fallback: Look for channelId in the page data
                const channelIdMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
                if (channelIdMatch) {
                    const channelId = channelIdMatch[1];
                    const nameMatch = html.match(/<title>([^<]+)<\/title>/);
                    let channelName = nameMatch ? nameMatch[1].replace(' - YouTube', '') : handle;
                    
                    return {
                        id: channelId,
                        handle: handle,
                        name: channelName,
                        thumbnail: ''
                    };
                }
            } catch (error) {
                console.warn(`Proxy ${proxy} failed:`, error);
                continue;
            }
        }
    } catch (error) {
        console.error('Error fetching channel page:', error);
    }
    
    // If all methods failed, show helpful error
    console.error('All API methods failed for handle:', handle);
    return null;
}

// Fetch channel thumbnail by channel ID
async function fetchChannelThumbnail(channelId) {
    // Try Piped API to get channel info by ID
    for (let i = 0; i < CONFIG.PIPED_INSTANCES.length; i++) {
        const instance = CONFIG.PIPED_INSTANCES[(state.currentPipedInstance + i) % CONFIG.PIPED_INSTANCES.length];
        
        try {
            // Try to get channel by ID
            const channelUrl = `${instance}/channel/${channelId}`;
            const channelResponse = await fetch(channelUrl);
            
            if (channelResponse.ok) {
                const channelData = await channelResponse.json();
                if (channelData.avatarUrl) {
                    state.currentPipedInstance = (state.currentPipedInstance + i) % CONFIG.PIPED_INSTANCES.length;
                    return channelData.avatarUrl;
                }
            }
        } catch (error) {
            console.warn(`Piped instance ${instance} failed for thumbnail:`, error);
            continue;
        }
    }
    
    return null;
}

// Update missing channel thumbnails
async function updateMissingThumbnails() {
    const channelsWithoutThumbnail = state.channels.filter(c => !c.thumbnail || c.thumbnail === '');
    
    if (channelsWithoutThumbnail.length === 0) return;
    
    let updatedCount = 0;
    
    for (const channel of channelsWithoutThumbnail) {
        try {
            const thumbnail = await fetchChannelThumbnail(channel.id);
            if (thumbnail) {
                channel.thumbnail = thumbnail;
                updatedCount++;
            }
        } catch (error) {
            console.warn(`Failed to fetch thumbnail for ${channel.name}:`, error);
        }
    }
    
    if (updatedCount > 0) {
        saveState();
        renderChannels();
        if (state.viewMode === 'channels') {
            renderChannelGrid();
        }
        console.log(`Updated ${updatedCount} channel thumbnails`);
    }
}

// Show instructions for finding Channel ID
function showChannelIdHelp() {
    const helpText = `
Die automatische Kanal-Suche funktioniert gerade nicht.

Du kannst die Channel ID manuell eingeben:
1. Gehe zum YouTube-Kanal
2. Klicke auf "Über diesen Kanal" oder "Info"
3. Klicke auf "Kanal teilen" → "Kanal-ID kopieren"
4. Die ID beginnt mit "UC" (z.B. UCXuqSBlHAE6Xw-yeJA0Tunw)

Füge diese ID im Feld ein!
    `.trim();
    
    alert(helpText);
}

function editChannel(channelId) {
    openChannelModal(channelId);
}

function deleteChannel(channelId) {
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel) return;
    
    if (confirm(`Möchtest du "${channel.name}" wirklich entfernen?`)) {
        state.channels = state.channels.filter(c => c.id !== channelId);
        // Also remove videos from this channel
        state.videos = state.videos.filter(v => v.channelId !== channelId);
        saveState();
        renderChannels();
        renderVideos();
        showToast(`${channel.name} entfernt`, 'success');
    }
}

function renderChannels() {
    if (state.channels.length === 0) {
        DOM.channelList.innerHTML = `
            <li class="channel-empty">
                <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">
                    Noch keine Kanäle hinzugefügt
                </p>
            </li>
        `;
        return;
    }
    
    DOM.channelList.innerHTML = state.channels.map((channel, index) => `
        <li class="channel-item" style="animation-delay: ${index * 50}ms">
            <div class="channel-avatar">
                ${channel.thumbnail 
                    ? `<img src="${channel.thumbnail}" alt="${channel.name}" onerror="this.style.display='none'; this.parentElement.textContent='${channel.name.charAt(0).toUpperCase()}';">`
                    : channel.name.charAt(0).toUpperCase()
                }
            </div>
            <div class="channel-info">
                <div class="channel-name">${escapeHtml(channel.name)}</div>
                <div class="channel-handle">@${escapeHtml(channel.handle)}</div>
            </div>
            <div class="channel-actions">
                <button onclick="editChannel('${channel.id}')" title="Bearbeiten">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button onclick="deleteChannel('${channel.id}')" class="delete" title="Löschen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </li>
    `).join('');
}

// ===========================
// Video Functions (RSS Feed based)
// ===========================
async function refreshVideos() {
    if (state.channels.length === 0) {
        showToast('Füge zuerst Kanäle hinzu', 'warning');
        return;
    }
    
    DOM.loadingState.classList.remove('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.videoGrid.innerHTML = '';
    
    try {
        const allVideos = [];
        let successCount = 0;
        
        for (const channel of state.channels) {
            try {
                const videos = await fetchChannelVideosRSS(channel);
                allVideos.push(...videos);
                successCount++;
            } catch (error) {
                console.error(`Error fetching videos for ${channel.name}:`, error);
            }
        }
        
        if (successCount === 0) {
            showToast('Fehler beim Laden der Videos. Versuche es später erneut.', 'error');
        } else {
            // Sort by date (newest first)
            allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            
            state.videos = allVideos;
            saveState();
            
            showToast(`${allVideos.length} Videos von ${successCount} Kanälen geladen`, 'success');
        }
        
    } catch (error) {
        console.error('Error fetching videos:', error);
        showToast('Fehler beim Laden der Videos', 'error');
    }
    
    DOM.loadingState.classList.add('hidden');
    renderVideos();
    
    // Update missing thumbnails in background (non-blocking)
    updateMissingThumbnails();
}

// Fetch videos using YouTube RSS Feed (no API key needed!)
async function fetchChannelVideosRSS(channel) {
    const rssUrl = CONFIG.RSS_FEED_URL + channel.id;
    
    // Try main proxy first, then backups
    const proxies = CONFIG.CORS_PROXIES;
    
    for (const proxy of proxies) {
        try {
            const response = await fetch(proxy + encodeURIComponent(rssUrl));
            
            if (!response.ok) continue;
            
            const xmlText = await response.text();
            return parseRSSFeed(xmlText, channel);
            
        } catch (error) {
            console.warn(`Proxy ${proxy} failed:`, error);
            continue;
        }
    }
    
    throw new Error('All proxies failed');
}

function parseRSSFeed(xmlText, channel) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const entries = xmlDoc.querySelectorAll('entry');
    const videos = [];
    
    entries.forEach(entry => {
        const videoId = entry.querySelector('yt\\:videoId, videoId')?.textContent;
        const title = entry.querySelector('title')?.textContent;
        const published = entry.querySelector('published')?.textContent;
        const mediaGroup = entry.querySelector('media\\:group, group');
        const thumbnail = mediaGroup?.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url');
        
        if (videoId && title) {
            videos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                channelId: channel.id,
                channelName: channel.name,
                channelThumbnail: channel.thumbnail || '',
                publishedAt: published || new Date().toISOString(),
                duration: '' // RSS doesn't include duration
            });
        }
    });
    
    return videos;
}

function markAsSeen(videoId) {
    state.seenVideos.add(videoId);
    saveState();
    renderVideos();
    showToast('Als gesehen markiert', 'success');
}

function markAllAsSeen() {
    const unseenVideos = state.videos.filter(v => !state.seenVideos.has(v.id));
    if (unseenVideos.length === 0) {
        showToast('Keine ungesehenen Videos', 'warning');
        return;
    }
    
    if (confirm(`${unseenVideos.length} Videos als gesehen markieren?`)) {
        unseenVideos.forEach(v => state.seenVideos.add(v.id));
        saveState();
        renderVideos();
        showToast('Alle Videos als gesehen markiert', 'success');
    }
}

function renderVideos() {
    // Filter to only show unseen videos
    let filteredVideos = state.videos.filter(v => !state.seenVideos.has(v.id));
    
    // Apply date filter if set
    if (state.startDate) {
        const startDateTime = new Date(state.startDate).getTime();
        filteredVideos = filteredVideos.filter(v => {
            const videoDate = new Date(v.publishedAt).getTime();
            return videoDate >= startDateTime;
        });
    }
    
    // Apply channel filter if viewing a specific channel
    if (state.filteredChannelId) {
        filteredVideos = filteredVideos.filter(v => v.channelId === state.filteredChannelId);
    }
    
    // Update count (just the number)
    DOM.videoCount.textContent = filteredVideos.length;
    
    // Show back button if filtered by channel
    let backHeader = '';
    if (state.filteredChannelId) {
        const channel = state.channels.find(c => c.id === state.filteredChannelId);
        if (channel) {
            const initial = channel.name.charAt(0).toUpperCase();
            backHeader = `
                <div class="back-header">
                    <button class="back-btn" onclick="goBackToChannels()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Zurück
                    </button>
                    <div class="back-channel-info">
                        <div class="back-channel-avatar">
                            ${channel.thumbnail 
                                ? `<img src="${channel.thumbnail}" alt="${escapeHtml(channel.name)}" onerror="this.style.display='none'">`
                                : initial
                            }
                        </div>
                        <span class="back-channel-name">${escapeHtml(channel.name)}</span>
                    </div>
                </div>
            `;
        }
    }
    
    if (filteredVideos.length === 0) {
        DOM.videoGrid.innerHTML = backHeader;
        DOM.emptyState.classList.remove('hidden');
        DOM.emptyState.querySelector('p').textContent = state.filteredChannelId 
            ? 'Keine neuen Videos von diesem Kanal' 
            : 'Keine neuen Videos';
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    
    const unseenVideos = filteredVideos;
    
    DOM.videoGrid.innerHTML = backHeader + unseenVideos.map((video, index) => {
        const publishedDate = new Date(video.publishedAt);
        const isNew = (Date.now() - publishedDate.getTime()) < 24 * 60 * 60 * 1000; // Less than 24 hours
        const relativeDate = getRelativeTime(publishedDate);
        
        return `
            <article class="video-card" style="animation-delay: ${index * 50}ms">
                <div class="video-thumbnail">
                    <a href="https://youtube.com/watch?v=${video.id}" target="_blank" rel="noopener">
                        <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${video.id}/hqdefault.jpg'">
                    </a>
                    ${video.duration ? `<span class="video-duration">${video.duration}</span>` : ''}
                    ${isNew ? '<span class="video-new-badge">Neu</span>' : ''}
                </div>
                <div class="video-info">
                    <h3 class="video-title">
                        <a href="https://youtube.com/watch?v=${video.id}" target="_blank" rel="noopener">
                            ${escapeHtml(video.title)}
                        </a>
                    </h3>
                    <div class="video-meta">
                        <div class="video-channel">
                            ${video.channelThumbnail ? `
                                <div class="video-channel-avatar">
                                    <img src="${video.channelThumbnail}" alt="${escapeHtml(video.channelName)}" onerror="this.style.display='none'">
                                </div>
                            ` : ''}
                            <span class="video-channel-name">${escapeHtml(video.channelName)}</span>
                        </div>
                        <span class="video-date">${relativeDate}</span>
                    </div>
                    <div class="video-actions">
                        <button class="btn-seen" onclick="markAsSeen('${video.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Gesehen
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    
    if (months > 0) return `vor ${months} Monat${months > 1 ? 'en' : ''}`;
    if (weeks > 0) return `vor ${weeks} Woche${weeks > 1 ? 'n' : ''}`;
    if (days > 0) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
    if (hours > 0) return `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
    if (minutes > 0) return `vor ${minutes} Minute${minutes > 1 ? 'n' : ''}`;
    return 'Gerade eben';
}

// ===========================
// Utility Functions
// ===========================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===========================
// Start the App
// ===========================
document.addEventListener('DOMContentLoaded', init);
