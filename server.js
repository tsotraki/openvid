import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Node 18+ has native fetch, so we don't strictly need node-fetch import if running modern node.
// But if specifically needed we would import it. Assuming Node 18+ based on environment.
// However, to be safe and broadly compatible, I'll rely on global fetch if available or try to import it.
// Actually, simple standard logic for modern Node projects is enough.

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// Helper: Parse ISO 8601 duration (PT1H2M3S) to seconds
function parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = (parseInt(match?.[1] || 0) || 0);
    const minutes = (parseInt(match?.[2] || 0) || 0);
    const seconds = (parseInt(match?.[3] || 0) || 0);

    return hours * 3600 + minutes * 60 + seconds;
}

// Helper: Format seconds to MM:SS or HH:MM:SS
function formatSeconds(seconds) {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Helper: Check filters
function matchesFilters(item, filters) {
    // Duration Filter
    const durationStr = item.duration;
    let seconds = 0;

    if (durationStr && durationStr !== 'N/A') {
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    }

    const filterDuration = filters.duration;
    if (filterDuration === 'short' && seconds >= 240) return false;
    if (filterDuration === 'medium' && (seconds < 240 || seconds > 1200)) return false;
    if (filterDuration === 'long' && seconds <= 1200) return false;

    // Date Filter
    if (filters.date !== 'all' && item.publishedAt) {
        const published = new Date(item.publishedAt);
        const now = new Date();
        const diffTime = Math.abs(now - published);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (filters.date === 'today' && diffDays > 1) return false;
        if (filters.date === 'week' && diffDays > 7) return false;
        if (filters.date === 'month' && diffDays > 30) return false;
        if (filters.date === 'year' && diffDays > 365) return false;
    }

    return true;
}

// ==================== PEERTUBE SERVICE ====================
async function searchPeerTube(query, maxResults = 10) {
    try {
        const instances = ['peertube.tv', 'framatube.org', 'video.hardlimit.com'];
        const instance = instances[Math.floor(Math.random() * instances.length)];

        const url = `https://${instance}/api/v1/search/videos?search=${encodeURIComponent(query)}&count=${maxResults}&sort=-match`;

        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();

        return (data.data || []).map(video => ({
            id: video.uuid,
            title: video.name,
            description: video.description || '',
            thumbnail: `https://${instance}${video.thumbnailPath}`,
            source: 'peertube',
            sourceLabel: 'PeerTube',
            duration: formatSeconds(video.duration),
            views: video.views,
            publishedAt: video.publishedAt,
            channelTitle: video.account?.displayName || 'Unknown',
            embedUrl: `https://${instance}/videos/embed/${video.uuid}`,
            watchUrl: video.url
        }));
    } catch (error) {
        console.error('PeerTube API error:', error.message);
        return [];
    }
}

// ==================== INTERNET ARCHIVE SERVICE ====================
async function searchArchive(query, maxResults = 10) {
    try {
        const fields = 'identifier,title,description,duration,date,downloads';
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)} AND mediatype:(movies)&fl=${fields}&rows=${maxResults}&output=json`;

        const response = await fetch(url);
        const data = await response.json();

        return (data.response.docs || []).map(doc => {
            const id = doc.identifier;
            let sec = 0;
            if (doc.duration && !isNaN(doc.duration)) sec = parseInt(doc.duration);

            return {
                id: id,
                title: doc.title,
                description: doc.description || '',
                thumbnail: `https://archive.org/services/img/${id}`,
                source: 'archive',
                sourceLabel: 'Internet Archive',
                duration: formatSeconds(sec),
                views: doc.downloads || 0,
                publishedAt: doc.date,
                channelTitle: 'Internet Archive',
                embedUrl: `https://archive.org/embed/${id}`,
                watchUrl: `https://archive.org/details/${id}`
            };
        });
    } catch (error) {
        console.error('Archive API error:', error.message);
        return [];
    }
}

// ==================== DAILYMOTION SERVICE ====================
async function searchDailymotion(query, maxResults = 10) {
    try {
        const fields = 'id,title,description,thumbnail_720_url,duration,views_total,created_time,owner.username,url';
        const url = `https://api.dailymotion.com/videos?search=${encodeURIComponent(query)}&fields=${fields}&limit=${maxResults}&sort=relevance`;

        const response = await fetch(url);
        const data = await response.json();

        return (data.list || []).map(video => ({
            id: video.id,
            title: video.title,
            description: video.description || '',
            thumbnail: video.thumbnail_720_url,
            source: 'dailymotion',
            sourceLabel: 'Dailymotion',
            duration: formatSeconds(video.duration),
            views: video.views_total,
            publishedAt: new Date(video.created_time * 1000).toISOString(),
            channelTitle: video['owner.username'] || 'Dailymotion User',
            embedUrl: `https://www.dailymotion.com/embed/video/${video.id}`,
            watchUrl: video.url
        }));
    } catch (error) {
        console.error('Dailymotion API error:', error.message);
        return [];
    }
}

// ==================== WIKIMEDIA COMMONS SERVICE ====================
async function searchWikimedia(query, maxResults = 10) {
    try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)} filetype:video&gsrlimit=${maxResults}&prop=imageinfo&iiprop=url|size|mime|extmetadata|timestamp&iiurlwidth=640`;

        const response = await fetch(url, { headers: { 'User-Agent': 'OpenVid/1.0 (Portfolio Project)' } });
        const data = await response.json();

        if (!data.query || !data.query.pages) return [];

        return Object.values(data.query.pages)
            .map(page => {
                const info = page.imageinfo?.[0];
                if (!info) return null;

                const metadata = info.extmetadata || {};
                const title = page.title.replace(/^File:/, '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

                const durationSec = metadata.Duration?.value ? parseFloat(metadata.Duration.value) : 0;

                return {
                    id: page.pageid.toString(),
                    title: title,
                    description: metadata.ImageDescription?.value?.replace(/<[^>]*>?/gm, '') || '',
                    thumbnail: info.thumburl || info.url,
                    source: 'wikimedia',
                    sourceLabel: 'Wikimedia',
                    duration: formatSeconds(durationSec),
                    views: 0,
                    publishedAt: info.timestamp,
                    channelTitle: metadata.Artist?.value?.replace(/<[^>]*>?/gm, '') || 'Wikimedia User',
                    embedUrl: info.url,
                    watchUrl: info.descriptionurl,
                    isDirectFile: true
                };
            })
            .filter(item => item !== null);
    } catch (error) {
        console.error('Wikimedia API error:', error.message);
        return [];
    }
}

// ==================== NASA SERVICE ====================
async function searchNASA(query, maxResults = 10) {
    try {
        const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.collection || !data.collection.items) return [];

        const items = data.collection.items.slice(0, maxResults);

        return items.map(item => {
            const datum = item.data[0];
            const nasaId = datum.nasa_id;
            const videoUrl = `https://images-assets.nasa.gov/video/${nasaId}/${nasaId}~orig.mp4`;

            return {
                id: nasaId,
                title: datum.title,
                description: datum.description || '',
                thumbnail: item.links?.[0]?.href || '',
                source: 'nasa',
                sourceLabel: 'NASA',
                duration: 'N/A',
                views: 0,
                publishedAt: datum.date_created,
                channelTitle: 'NASA ' + (datum.center || ''),
                embedUrl: videoUrl,
                watchUrl: `https://images.nasa.gov/details-${nasaId}`,
                isDirectFile: true
            };
        });
    } catch (error) {
        console.error('NASA API error:', error.message);
        return [];
    }
}

// ==================== MAIN SEARCH API ====================
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    const sources = (req.query.sources || 'peertube,archive,dailymotion,wikimedia,nasa').split(',');
    const sort = req.query.sort || 'relevance';
    const durationFilter = req.query.duration || 'all';
    const dateFilter = req.query.date || 'all';

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const limitPerSource = 15;

    // Define search promises based on requested sources
    const searchPromises = [];

    if (sources.includes('peertube')) searchPromises.push(searchPeerTube(query, limitPerSource));
    if (sources.includes('archive')) searchPromises.push(searchArchive(query, limitPerSource));
    if (sources.includes('dailymotion')) searchPromises.push(searchDailymotion(query, limitPerSource));
    if (sources.includes('wikimedia')) searchPromises.push(searchWikimedia(query, limitPerSource));
    if (sources.includes('nasa')) searchPromises.push(searchNASA(query, limitPerSource));

    try {
        const results = await Promise.all(searchPromises);
        let allVideos = results.flat();

        // 1. Filter
        if (durationFilter !== 'all' || dateFilter !== 'all') {
            allVideos = allVideos.filter(video => matchesFilters(video, { duration: durationFilter, date: dateFilter }));
        }

        // 2. Sort
        if (sort === 'date') {
            allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        } else if (sort === 'views') {
            allVideos.sort((a, b) => b.views - a.views);
        } else {
            allVideos.sort(() => Math.random() - 0.5);
        }

        res.json({
            results: allVideos,
            totalResults: allVideos.length
        });
    } catch (error) {
        console.error('Search failed:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        sources: ['peertube', 'archive', 'dailymotion', 'wikimedia', 'nasa']
    });
});

// Export app for serverless usage
export default app;

// Only start server if run directly (local dev)
// Check if file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    app.listen(PORT, () => {
        console.log(`🎬 OpenVid Server running at http://localhost:${PORT}`);
        console.log(`✅ All sources are OPEN and FREE`);
    });
}
