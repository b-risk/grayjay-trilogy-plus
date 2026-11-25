// Platform information
const platform = {
    title: 'Trilogy Plus',
    url: 'https://www.trilogyplus.com/',
    icon: 'https://dr56wvhu2c8zo.cloudfront.net/trilogyplus/assets/739ad5e0-ee07-4677-ac2b-c0c5ab40adb3.png',
    banner: 'https://vhx.imgix.net/trilogyplus/assets/f3585167-d60e-4292-8096-e4bbe260b959.png?auto=format&fit=crop&w=1280',
    description: 'Trilogy Plus is an immersive streaming service with the best entertainment in scambaiting, scam-busting, travel and true crime.'
}

// Base URLs for the two Vimeo OTT APIs this plugin talks to
const SITE_API_BASE = 'https://api.vhx.com/v2/sites/156301/';
const VHX_API_BASE = 'https://api.vhx.tv/';

// API endpoints
const api = {
    base: SITE_API_BASE,
    collections: SITE_API_BASE + 'collections/',
    categories: SITE_API_BASE + 'categories',
    comments: 'https://api.vhx.com/comments/',
    videos: VHX_API_BASE + 'videos/',
    customers: VHX_API_BASE + 'customers/',
    uiAvatars: 'https://ui-avatars.com/api/?color=ffffff&bold=true&format=png&size=128&length=1&background='
}

// Regex variables used for extracting details
const regex = {
    contentUrl: /^https:\/\/www\.trilogyplus\.com\/videos\/[^\/]+$/,
    collectionUrl: /^https:\/\/(?:www\.)?trilogyplus\.com\/[^\/]+$/,
    channelId: /"COLLECTION_ID":"?([^",]+)"?,"COLLECTION_TITLE"/,
    videoId: /"video","VIDEO_ID":(\d+)/,
    bearerToken: /window\.TOKEN\s*=\s*"([^"]+)";/m,
    currentUserId: /window\._current_user\s*=\s*\{[\s\S]*?"id"\s*:\s*(\d+)/m,
    watchlistUrl: /^https:\/\/(?:www\.)?trilogyplus\.com\/watchlist\/?$/,
}

// Supported resolution types
const supportedResolutions = {
    '1440p': { width: 2560, height: 1440 },
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 },
    '540p': { width: 960, height: 540 },
    '480p': { width: 854, height: 480 },
    '360p': { width: 640, height: 360 },
    '240p': { width: 426, height: 240 },
    '144p': { width: 256, height: 144 }
}

// Homepage collections
const homepageIds = [
    1067129, // Free Videos
    1491720, // New Releases
    1480905 // Popular
]

// Watchlist request settings
const WATCHLIST_PRODUCT_ID = 122755;
const WATCHLIST_PER_PAGE = 12;

// Listing page sizes (the categories endpoint's own default)
const CATEGORIES_PER_PAGE = 25;
const SEARCH_PER_PAGE = 100;
// How many uncategorized videos the pager serves per page
const UNCATEGORIZED_PER_PAGE = 100;

// The sorted uncategorized video lists, keyed by the search query they were built from
let uncategorizedCache = {};

let config = {};
let settings = {};

// ============================== Source lifecycle ==============================

// Enable source
source.enable = function (conf, _settings) {
    config = conf;
    settings = _settings;
}

// ============================== Home feed ==============================

// Get home results (the home feed is a single page)
source.getHome = function() {
    return new VideoPager(getHomeResults(), false);
}

// ============================== Search ==============================

// Get search suggestions
source.searchSuggestions = function(query) {
    /**
     * @param query: string
     * @returns: string[]
     */

    const suggestions = []; //The suggestions for a specific search query
    return suggestions;
}

// Get search capabilities
source.getSearchCapabilities = function() {
    //This is an example of how to return search capabilities like available sorts, filters and which feed types are available (see source.js for more details) 
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological, "^release_time"],
        filters: [
            {
                id: "date",
                name: "Date",
                isMultiSelect: false,
                filters: [
                    { id: Type.Date.Today, name: "Last 24 hours", value: "today" },
                    { id: Type.Date.LastWeek, name: "Last week", value: "thisweek" },
                    { id: Type.Date.LastMonth, name: "Last month", value: "thismonth" },
                    { id: Type.Date.LastYear, name: "Last year", value: "thisyear" }
                ]
            },
        ]
    };
}

// Get video search results
source.search = function (query, type, order, filters, continuationToken) {
    const result = getSearchResults(1, query, 'video');
    return new SearchResultsPager(result.results, result.hasMore, { query: query, page: 1 });
}

// Get capabilities for search
source.getSearchChannelContentsCapabilities = function () {
    //This is an example of how to return search capabilities on a channel like available sorts, filters and which feed types are available (see source.js for more details)
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
}

// Search channel videos
source.searchChannelContents = function (url, query, type, order, filters, continuationToken) {
    return getChannelVideosPager(url, type, order, filters, continuationToken, query);
}

// Search channels
source.searchChannels = function (query, continuationToken) {
    const result = getSearchResults(1, query, 'series');
    return new SearchChannelsPager(result.results, result.hasMore, { query: query, page: 1 });
}

// ============================== Channels ==============================

// Detect channel URL
source.isChannelUrl = function(url) {
    // The watchlist URL also matches collectionUrl, but is never a channel
    if (regex.watchlistUrl.test(url))
        return false;

    if (regex.collectionUrl.test(url)) { // Detect collection series
        // Only pages that embed a collection id can be a series
        const id = getSeriesId(url);
        if (id == null)
            return false;

        return getCollectionDetails(id, false).type == 'series';
    } else {
        return url == platform.url // Detect dummy channel with miscellaneous videos
    }
}

// Get channel details
source.getChannel = function(url) {
    // Get channel, handles both collections and non-series dummy channel
    const channel = (url !== platform.url) && getCollectionDetails(getSeriesId(url), false, getBearer());

    return getPlatformChannel(channel);
}

// Get channel videos
source.getChannelContents = function(url, type, order, filters, continuationToken) {
    return getChannelVideosPager(url, type, order, filters, continuationToken);
}

// Get channel playlists
source.getChannelPlaylists = function(url) {
    // Detect dummy channel
    if (url == platform.url) {
        // Get and return all collections
        const bearer = getBearer();
        const collectionLists = getCollectionLists(1, bearer);
        const hasMore = true;
        const context = { perPage: CATEGORIES_PER_PAGE, count: collectionLists.count, bearer };
        return new CollectionListsPager(collectionLists.results, hasMore, context);
    }

    return new CollectionListsPager([], false, {});
}

// ============================== Video content ==============================

// Detect video URL
source.isContentDetailsUrl = function(url) {
    return regex.contentUrl.test(url);
}

// Get video details
source.getContentDetails = function(url) {
    // Check if user is logged in, necessary for content on Trilogy Plus
    const userAuth = bridge.isLoggedIn();

    if (!userAuth) 
        throw new LoginRequiredException('Login required for Trilogy Plus content');

    const bearer = getBearer(userAuth);

    // Get video details
    const video = getVideoDetails(url, bearer, userAuth);
    
    // Request video sources
    const sourceDetails = httpGET(api.videos + video.id + '/files', true, true, bearer);

    if (!sourceDetails.isOk) {
        if (sourceDetails.code == 402 || sourceDetails.code == 403)
            throw new LoginRequiredException('Subscription required for premium content');
        throw new ScriptException(`Failed to retrieve video details for video ID ${video.id} [${sourceDetails.code}]`);
    }
    
    // Get channel details, returns null if not part of series and dummy channel details are used
    const channel = video.metadata?.series_id != null && getCollectionDetails(video.metadata?.series_id, userAuth, bearer);
    
    let sources = [];

    // Loop through video sources
    // NOTE: deliberately named `file` so it does not shadow the global `source` object
    for (const file of Object.values(JSON.parse(sourceDetails.body))) {
        // Translate quality into width and height data
        const quality = supportedResolutions[file.quality];

        // Detect supported video formats
        if (file.method == "hls") {
            sources.push(new HLSSource({
                name: file.quality + '/' + file.mime_type,
                url: file._links.source.href,
                priority: true
            }));
        } else if (file.method == "progressive" && quality) {
            sources.push(new VideoUrlSource({
                width: quality.width,
                height: quality.height,
                container: file.mime_type,
                codec: file.codec,
                name: file.quality + '/' + file.mime_type,
                // Files without a reported size, or a zero-length video, have no meaningful bitrate
                bitrate: file.size?.bytes && video.duration?.seconds ? Math.round((file.size.bytes * 8) / video.duration.seconds) : 0,
                duration: Math.round(video.duration?.seconds ?? 0),
                url: file._links.source.href
            }));
        }
    }

    // A video the API knows about can still have no files this account can play
    if (sources.length == 0)
        throw new ScriptException(`No playable video sources found for video ID ${video.id}`);

    // Return video details
    return new PlatformVideoDetails({
        id: new PlatformID(platform.title, String(video.id), config.id),
        name: video.name,
        thumbnails: new Thumbnails([new Thumbnail(video.thumbnail.source, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, String(video?.metadata?.series_id), config.id),
            video?.metadata?.series_name || "Trilogy Plus",
            channel?.page_url || platform.url,
            channel?.thumbnails?.["16_9"]?.large || platform.icon
        ),
        url: url,
        datetime: Math.round((new Date(video.created_at)).getTime() / 1000),
        duration: video.duration?.seconds,
        viewCount: null,
        description: video.description,
        isLive: video.live_video,
        video: new VideoSourceDescriptor(sources)
    });
}

// ============================== Playlists ==============================

// Detect playlist url, for TrilogyPlus non-series collections are used as playlists
source.isPlaylistUrl = function (url) {
    // The watchlist URL also matches collectionUrl, so it has to be checked first or the
    // collection lookup below fails and breaks URL routing
    if (regex.watchlistUrl.test(url))
        return true;

    if (regex.collectionUrl.test(url)) { // Detect collection URL
        const id = getSeriesId(url);
        if (id == null)
            return false;

        const collectionType = getCollectionDetails(id, false)?.type;
        // Detect if collection is a playlist or home category
        return collectionType == 'playlist' || collectionType == 'category';
    }

    return false;
}

// Get playlist
source.getPlaylist = function (url, id, bearer, page = 1) {
    const userAuth = bridge.isLoggedIn();

    if (regex.watchlistUrl.test(url)) {
        if (!userAuth) 
            throw new LoginRequiredException('Login required to access watchlist');

        const browseResp = http.GET(platform.url + 'browse', {}, userAuth);

        if (!browseResp.isOk) 
            throw new ScriptException('Failed to retrieve homepage for details');

        const userId = extractDetail(browseResp.body, regex.currentUserId);
        bearer = extractDetail(browseResp.body, regex.bearerToken);
        if (!userId || !bearer) 
            throw new ScriptException('Failed to get user credentials');

        const result = getWatchlistVideos(bearer, userId, page);

        return new PlatformPlaylistDetails({
            id: new PlatformID(platform.title, 'watchlist', config.id),
            name: 'My Watchlist',
            thumbnails: new Thumbnails([new Thumbnail(platform.icon)]),
            author: new PlatformAuthorLink(
                new PlatformID(platform.title, null, config.id),
                platform.title,
                platform.url,
                platform.icon,
            ),
            url,
            thumbnail: platform.icon,
            contents: new WatchlistContentsPager(result.videos, result.hasMore, { userId, bearer })
        });
    }

    bearer = bearer || getBearer();
    id = id || getSeriesId(url);

    // Get playlist detials and videos
    const playlist = getCollectionDetails(id, userAuth, bearer);
    const playlistVideos = getPlaylistVideos(id, page, bearer);

    const context = {url: url, playlistId: id, bearer: bearer, pages: playlistVideos.pagination.count, perPage: playlistVideos.pagination.per_page};

    // Categories can come back without a thumbnail (or with a placeholder), fall back to the platform banner
    const playlistThumbnail = playlist.thumbnails?.['16_9']?.large;
    const thumbnail = (!playlistThumbnail || playlistThumbnail.includes('default')) ? platform.banner : playlistThumbnail;

    // Return playlist
    return new PlatformPlaylistDetails({
        id: new PlatformID(platform.title, String(playlist.id), config.id),
        name: playlist.title,
        thumbnails: new Thumbnails([new Thumbnail(thumbnail)]),
        author: new PlatformAuthorLink(
            new PlatformID(
                platform.title, 
                null, 
                config.id
            ), 
            platform.title, 
            platform.url, 
            platform.icon,
        ),
        url,
        thumbnail: thumbnail,
        contents: new PlaylistContentsPager(playlistVideos.videos, playlistVideos.pagination.count > playlistVideos.pagination.current, context)
    });
}

// Get user's playlists (for Import Playlists)
source.getUserPlaylists = function () {
    return [platform.url + 'watchlist'];
}

// Search playlists
source.searchPlaylists = function (query, type, order, filters, continuationToken) {
    const result = getSearchResults(1, query, 'playlist');
    return new SearchPlaylistsPager(result.results, result.hasMore, { query: query, page: 1 });
}

// ============================== Comments ==============================

// Get video comments
source.getComments = function (url, continuationToken) {
    const bearer = getBearer(bridge.isLoggedIn())
    const video = getVideoDetails(url, bearer, bridge.isLoggedIn());
    
    const commentsResp = httpGET(video._links.comments.href, true, false, bearer);

    if (!commentsResp.isOk)
        throw new ScriptException(`Failed to retrieve comments [${commentsResp.code}]`);

    // Map comments
    const comments = JSON.parse(commentsResp.body)?._embedded?.comments?.map(comment =>
        parseComment(comment, url, { id: String(comment.id ?? '') })
    ) ?? [];

    const hasMore = false; // Are there more pages?
    const context = { url: url, continuationToken: continuationToken }; // Relevant data for the next page
    return new CommentsPager(comments, hasMore, context);
}

// Get sub comments
source.getSubComments = function (comment) {
    // Parse comment if string
    if (typeof comment === 'string') {
        try {
            comment = JSON.parse(comment);
        } catch (e) {
            return new CommentPager([], false);
        }
    }

    if (!comment || !comment.contextUrl || !comment.context || !comment.context.id) {
        return new CommentPager([], false);
    }

    // Comment parameters
    return getSubCommentsPager(comment.contextUrl, comment.context.id);
}

// ============================== Helpers ==============================

/**
 * Map a comment API object into a Comment instance
 * @param {object} comment - Comment data from API
 * @param {string} contextUrl - URL of the video the comment belongs to
 * @param {object} context - Context object (varies for top-level vs sub-comments)
 * @returns {Comment}
 */
function parseComment(comment, contextUrl, context) {
    const customer = comment._embedded?.customer;
    let name = customer?.name;

    // Handle cases where comment author name doesn't exist, common for comments on TrilogyPlus
    if (!name || name == '')
        name = 'Anonymous'

    return new Comment({
        contextUrl: contextUrl || '',
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, name, String(config.id ?? '')),
            name,
            '',
            getAvatar(customer?.thumbnail?.medium, customer?.id, customer?.name)
        ),
        message: String(comment.content ?? ''),
        rating: new RatingLikes(comment.like_count ?? 0),
        date: Math.max(0, parseInt((new Date(comment.created_at ?? 0)).getTime() / 1000)),
        replyCount: comment.comments_count ?? 0,
        context: context
    });
}

/**
 * Get the sub-comments (replies) of a comment
 * @param {string} contextUrl - URL of the parent video
 * @param {string|number} parentId - ID of the comment to fetch replies for
 * @returns {CommentPager}
 */
function getSubCommentsPager(contextUrl, parentId) {
    // Retrieve sub comments
    const commentsResp = httpGET(
        api.comments + parentId,
        true,
        false
    );

    if (!commentsResp.isOk)
        throw new ScriptException(`Failed to retrieve comments [${commentsResp.code}]`);

    // Map comments
    const comments = JSON.parse(commentsResp.body)?._embedded?.comments?.map(subComment =>
        parseComment(subComment, contextUrl, { id: String(subComment.id ?? '') })
    ) ?? [];
    
    return new CommentPager(comments, false);
}

/**
 * Get bearer token from the site or provided HTML
 * @param {boolean} useAuth - Whether to use authentication for the request
 * @param {string} [html] - Optional HTML to extract token from instead of fetching
 * @returns {string} Bearer token
 */
function getBearer(useAuth, html) {
    if (html) {
        return extractDetail(html, regex.bearerToken);
    } else {
        const siteResp = http.GET(platform.url + 'browse', {}, useAuth || false);
        if (!siteResp.isOk)
            throw new ScriptException(`Failed to get bearer token [${siteResp.code}]`);

        const bearer = extractDetail(siteResp.body, regex.bearerToken);
        if (!bearer || typeof(bearer) !== 'string')
            throw new ScriptException(`Bearer token not found in page HTML (${siteResp.body.length} characters fetched)`);

        // When expecting an authenticated session, verify the user is actually logged in.
        // The _session cookie may still exist locally but the server-side session can expire,
        // causing the server to return a public-scoped token that will fail for protected API calls.
        if (useAuth) {
            const userId = extractDetail(siteResp.body, regex.currentUserId);
            if (!userId)
                throw new LoginRequiredException('Session expired, please log in again');
        }

        return bearer;
    };
}

/**
 * Convert a collection object into a PlatformPlaylist
 * @param {object} playlist - Collection data from API
 * @returns {PlatformPlaylist}
 */
function getPlatformPlaylist(playlist) {
    const playlistThumbnail = playlist.thumbnails?.['16_9']?.medium;
    // Handle cases where thumbnail is nonexistant, mainly in the case of categories
    const thumbnail = (!playlistThumbnail || playlistThumbnail.includes('default')) && platform.banner || playlistThumbnail;
    return new PlatformPlaylist({
        id: new PlatformID(platform.title, playlist.id.toString(), config.id),
        author: new PlatformAuthorLink(
            new PlatformID(
                platform.title, 
                playlist.site_id?.toString() ?? null,
                config.id
            ), 
            platform.title, 
            platform.url, 
            platform.icon
        ),
        name: playlist.title,
        thumbnail: thumbnail || platform.banner,
        videoCount: playlist.videos_count,
        url: playlist.page_url
    });
}

/**
 * Convert a video object into a PlatformVideo
 * @param {object} video - Video data from API
 * @param {object|null} channel - Channel/series data if available
 * @returns {PlatformVideo}
 */
function getPlatformVideo(video, channel) {
    return new PlatformVideo({
        id: new PlatformID(platform.title, String(video.id), config.id),
        name: video.title,
        thumbnails: new Thumbnails([new Thumbnail(video.thumbnails?.["16_9"]?.medium, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, String(video.metadata?.series?.id), config.id),
            video.metadata?.series?.name || platform.title,
            channel?.page_url || platform.url,
            channel?.thumbnails?.["16_9"]?.medium || platform.icon
        ),
        datetime: parseInt((new Date(video.created_at)).getTime() / 1000),
        duration: video.duration?.seconds,
        viewCount: null,
        url: video.page_url,
        shareUrl: video.page_url,
        isLive: video.live_video
    });
}

/**
 * Convert a channel/collection object into a PlatformChannel.
 * When called with no argument, returns the default platform channel.
 * @param {object|null} [channel] - Channel data from API
 * @returns {PlatformChannel}
 */
function getPlatformChannel(channel) {
    const thumbnail = channel?.thumbnails?.["1_1"]?.medium || platform.icon;
    return new PlatformChannel({
        id: new PlatformID(platform.title, channel ? String(channel.id) : null, config.id),
        name: channel?.title || platform.title,
        thumbnail,
        banner: channel?.thumbnails?.["16_6"]?.source || (channel ? thumbnail : platform.banner),
        subscribers: null,
        description: channel?.description || platform.description,
        url: channel?.page_url || platform.url,
        links: {}
    });
}

/**
 * Get videos in a playlist/collection
 * @param {number} id - Collection ID
 * @param {number} page - Page number
 * @param {string} bearer - Bearer token
 * @returns {{videos: PlatformVideo[], pagination: object}}
 */
function getPlaylistVideos(id, page, bearer) {
    bearer = bearer || getBearer();
    const playlistVideos = getCollectionVideos(id, bearer, page);
    const results = [];

    for (const v of Object.values(playlistVideos.items)) {
        const video = v.entity;
        const seriesId = video.metadata?.series?.id;
        const channel = seriesId && getCollectionDetails(seriesId, false, bearer);
        if (video.type == 'video')
            results.push(getPlatformVideo(video, channel));
    }
    
    return {videos: results, pagination: playlistVideos.pagination};
}

/**
 * Get the home feed videos for the homepage collection selected in the plugin settings
 * @returns {PlatformVideo[]}
 */
function getHomeResults() {
    const bearer = getBearer();

    const homeResp = httpGET(
        api.collections + homepageIds[settings.homeFeedSource] + '/items',
        true,
        false,
        bearer
    );

    if (!homeResp.isOk) {
        // Throw captcha to get new cookies if request fails
        const siteResp = httpGET(platform.url  + 'browse', false, true, bearer);
        throw new CaptchaRequiredException(platform.url + 'browse', siteResp.body);
    }

    const results = [];

    for (const e of Object.values(JSON.parse(homeResp.body).items)) {
        const entity = e.entity;

        // Exclude series (channels) from home results
        if ( entity.type == 'series' )
            continue;

        // Series details are only needed for the author link, so only fetch them for the videos we keep
        const seriesId = entity.metadata?.series?.id;
        const channel = seriesId != null && getCollectionDetails(seriesId, false, bearer);

        results.push(getPlatformVideo(entity, channel));
    }

    return results;
}

/**
 * Get every uncategorized (non-series) video, newest first.
 *
 * Site search is the only endpoint that reaches the whole catalogue with each video's
 * series inline, so videos that belong to no series can be filtered without fetching
 * their collection details. The search API ignores every sort parameter and returns
 * its results in relevance order, so the whole catalogue is fetched up front and sorted
 * here. Page 1 fixes the total and is fetched on its own; the remaining pages are
 * fetched in a single parallel batch (the engine runs http.batch() concurrently), which
 * keeps the walk to roughly one request's wall time instead of one request per page.
 * @param {string} [query] - Optional search query, falls back to the wildcard when empty
 * @returns {PlatformVideo[]}
 */
function getUncategorizedVideos(query) {
    const cacheKey = query || '';
    if (uncategorizedCache[cacheKey])
        return uncategorizedCache[cacheKey];

    const q = (query && query.trim().length > 0) ? query.trim() : '*';
    const bearer = getBearer();
    const headers = {
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json',
        Referer: platform.url
    };
    const pageUrl = p => `${api.base}search?q=${encodeURIComponent(q)}&type=video&page=${p}&per_page=${SEARCH_PER_PAGE}`;

    // Page 1 both fixes the total and contributes the first results
    const first = httpGET(pageUrl(1), true, false, bearer);
    if (!first.isOk)
        throw new ScriptException(`Search page 1 failed [${first.code}]`);

    let raw = [...(JSON.parse(first.body).results ?? [])];
    const total = (JSON.parse(first.body).pagination ?? {}).count ?? 0;
    const pageCount = Math.ceil(total / SEARCH_PER_PAGE);

    // Fetch the remaining pages in one parallel batch
    if (pageCount > 1) {
        let builder = http.batch();
        for (let p = 2; p <= pageCount; p++)
            builder = builder.GET(pageUrl(p), headers, false);

        const responses = builder.execute();
        for (const resp of Object.values(responses)) {
            if (!resp.isOk)
                throw new ScriptException(`Search page failed [${resp.code}]`);
            raw.push(...(JSON.parse(resp.body).results ?? []));
        }
    }

    // Dedup by id: the same video can surface on more than one page
    const seen = {};
    const entities = [];
    for (const e of Object.values(raw)) {
        const entity = e.entity;

        // Series are their own channel, everything else here is uncategorized
        if (entity.type != 'video')
            continue;
        if (entity.metadata?.series?.id != null)
            continue;

        const id = String(entity.id);
        if (seen[id])
            continue;
        seen[id] = true;
        entities.push(entity);
    }

    // Newest first, by the same date the video displays
    entities.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    uncategorizedCache[cacheKey] = entities.map(entity => getPlatformVideo(entity, null));
    return uncategorizedCache[cacheKey];
}

/**
 * Get a pager for channel/series videos
 * @param {string} url - Channel URL
 * @param {string} type - Feed type
 * @param {string} order - Sort order
 * @param {object[]} filters - Active filters
 * @param {*} continuationToken - Pagination token
 * @param {string} [query] - Optional search query
 * @returns {ChannelContentsPager}
 */
function getChannelVideosPager(url, type, order, filters, continuationToken, query) {
    let hasMore = false; // Are there more pages?
    let context = { url: url, query: null, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page

    // Check if channel is the non-series (dummy) channel, then return the uncategorized videos.
    // Site search lists every video on the platform with its series inline, so videos without a
    // series can be filtered out without any extra request, and the whole catalogue is reachable
    // through pagination instead of only the curated New Releases feed.
    if (url == platform.url) {
        const videos = getUncategorizedVideos(query);
        // page 0 is what the constructor hands out; nextPage() advances to page 1
        const context = { videos: videos, page: 0 };
        return new UncategorizedContentsPager(
            videos.slice(0, UNCATEGORIZED_PER_PAGE),
            videos.length > UNCATEGORIZED_PER_PAGE,
            context
        );
    }

    const bearer = getBearer();
    const channelResp = httpGET(url, false, false, bearer);
    const id = extractDetail(channelResp.body, regex.channelId);

    // Fetch series details
    const channel = id && getCollectionDetails(id, false, bearer);  

    // Retrieve seasons from API
    const seasonsResp = httpGET(`${api.collections}${id}/items`, true, false, bearer);

    if (!seasonsResp.isOk)
        throw new ScriptException(`Failed to retrieve series seasons [${seasonsResp.code}]`);

    // Parse details on seasons, put them in reverse order to make them newest to oldest
    const seasons = JSON.parse(seasonsResp.body).items.reverse()

    let videos = []; // The results (PlatformVideo)

    // Loop through each season
    for (const season of Object.values(seasons)) {
        // Fetch season episodes
        const seasonResp = httpGET(`${api.collections}${season.entity.id}/items`, true, false, bearer);
        
        if (!seasonResp.isOk) 
            throw new ScriptException(`Failed to retrieve channel season details [${seasonResp.code}]`)
        
        // Parse videos, in reverse order from newest to oldest
        const channelVideos = JSON.parse(seasonResp.body).items.reverse();
        
        // Loop through season videos
        for (const v of Object.values(channelVideos)) {
            const video = v.entity;
            // Use query to filter videos if provided
            if (query && video.title.toLowerCase().includes(query.toLowerCase()) || !query)
                videos.push(getPlatformVideo(video, channel));
        }
    }

    return new ChannelContentsPager(videos, hasMore, context);
}

/**
 * Query the site search API
 * @param {number} page - Page number
 * @param {string} query - Search query string
 * @param {string} type - Result type ('video' or 'collection')
 * @param {number} [perPage] - Results per page, defaults to SEARCH_PER_PAGE
 * @param {string} [bearer] - Bearer token, fetched when omitted
 * @returns {{results: object[], total: number}}
 */
function searchSite(page, query, type, perPage, bearer) {
    bearer = bearer || getBearer();

    const searchResp = httpGET(
        `${api.base}search?q=${encodeURIComponent(query)}&type=${type}&page=${page}&per_page=${perPage ?? SEARCH_PER_PAGE}`,
        true,
        false,
        bearer
    );

    if (!searchResp.isOk)
        throw new ScriptException(`Search for '${query}' (${type}) failed with code [${searchResp.code}]`);

    const data = JSON.parse(searchResp.body);
    return { results: data.results ?? [], total: data.pagination?.count ?? 0 };
}

/**
 * Search for videos, series, or playlists
 * @param {number} page - Page number
 * @param {string} query - Search query string
 * @param {string} returnType - Type of results ('video', 'series', or 'playlist')
 * @returns {{results: Array<PlatformVideo|PlatformChannel|PlatformPlaylist>, hasMore: boolean}}
 */
function getSearchResults(page, query, returnType) {
    // Series and playlists are both collections to the search API
    const searchType = (returnType == 'series' || returnType == 'playlist') ? 'collection' : returnType;
    const bearer = getBearer();
    const search = searchSite(page, query, searchType, SEARCH_PER_PAGE, bearer);

    const results = [];

    // Make an extra check for the uncategorized channel to be included in channel search
    if (returnType == 'series') {
        // Add uncategorized channel "Trilogy Plus" if search query matches
        if (platform.title.toLowerCase().includes(query.toLowerCase()))
            results.push(getPlatformChannel());
    }

    // Loop through results
    for (const e of Object.values(search.results)) {
        const entity = e.entity

        // Detect content type
        if (entity.type == returnType) {
            if (returnType == 'series') {
                results.push(getPlatformChannel(entity));
            } else if (returnType == 'playlist') {
                results.push(getPlatformPlaylist(entity));
            } else if (returnType == 'video') {
                const seriesId = entity.metadata?.series?.id;
                const channel = seriesId && getCollectionDetails(seriesId, false, bearer);

                results.push(getPlatformVideo(entity, channel));
            }
        }
    }

    return { results, hasMore: (page * SEARCH_PER_PAGE) < search.total };
}

/**
 * Get avatar URL for a comment author
 *
 * Customers with an uploaded avatar come back with a real image URL and are passed
 * through. Customers without one come back with Gravatar's `d=blank`, which renders as
 * nothing, so the pair Trilogy Plus itself displays is rendered instead: the site's
 * palette colour, keyed by the customer's id, behind the first character of their name
 * in white. Comments only support image avatars, so that pair is rendered to an image
 * with the UI Avatars API rather than with CSS.
 * @param {string} [avatar] - Avatar URL from the API
 * @param {number} [customerId] - Customer id, selects the fallback colour
 * @param {string} [name] - Customer name, supplies the initial letter
 * @returns {string} Avatar URL
 */
function getAvatar(avatar, customerId, name) {
    if (avatar && !avatar.includes('d=blank'))
        return avatar;

    // Trilogy Plus's fallback palette, indexed by customer id the same way the site does;
    // the '#' is dropped because it would terminate the query string
    const fallbackColors = ["#144f79", "#8a3b7f", "#d1184d", "#da7868", "#9eba41", "#226657", "#30909d", "#999999"];
    const color = (fallbackColors[Number(customerId) % fallbackColors.length] ?? "#144f79").substring(1);

    // The site uppercases the first character of the name for the letter
    const initial = (name || '').trim().charAt(0).toUpperCase();

    return `${api.uiAvatars}${color}&name=${encodeURIComponent(initial)}`;
}

/**
 * Make an authenticated HTTP GET request
 * @param {string} url - Request URL
 * @param {boolean} useMethod - Whether to include Authorization and Accept headers
 * @param {boolean} useAuth - Whether to use stored authentication
 * @param {string} bearer - Bearer token
 * @returns {object} HTTP response object
 */
function httpGET(url, useMethod, useAuth, bearer) {
    // Only fetch bearer token if it will actually be used
    if (bearer === undefined && useMethod) {
        bearer = useAuth ? getBearer(true) : getBearer();
    }
    const method = useMethod && { 
            Authorization: `Bearer ${bearer ?? ''}`,
            Accept: 'application/json',
            Referer: platform.url 
        } || {};
    
    // useAuth can arrive undefined when a caller omits it (isChannelUrl / isPlaylistUrl call
    // getCollectionDetails with a single argument), and the engine cannot bind undefined to
    // http.GET's bool parameter
    const response = http.GET(url, method, !!useAuth);

    return response;
}

/**
 * Get video details from a video page URL
 * @param {string} url - Video page URL
 * @param {string} bearer - Bearer token
 * @param {boolean} useAuth - Whether to use authenticated requests
 * @returns {object} Video details from API
 */
function getVideoDetails(url, bearer, useAuth) {
    const videoResp = httpGET(
        url, 
        false, 
        useAuth
    );
    
    if (!videoResp.isOk) 
        throw new ScriptException(`Failed to retrieve video ${url} [${videoResp.code}]`);
    
    const id = extractDetail(videoResp.body, regex.videoId);

    const videoDetailsResp = httpGET(api.videos + id, true, useAuth, bearer);

    if (!videoDetailsResp.isOk)
        throw new ScriptException(`Failed to retrieve video details [${videoDetailsResp.code}]`);

    return JSON.parse(videoDetailsResp.body);
}

// Collection details (title, thumbnails, type) change rarely and the same series shows up
// repeatedly within a single listing, so results are cached for the lifetime of the script
const collectionDetailsCache = new Map();

/**
 * Get collection (series/playlist) details by ID
 * @param {number} id - Collection ID
 * @param {boolean} userAuth - Whether to use authentication
 * @param {string} bearer - Bearer token
 * @returns {object} Collection details
 */
function getCollectionDetails(id, userAuth, bearer) {
    const key = String(id);
    const cached = collectionDetailsCache.get(key);
    if (cached)
        return cached;

    const channelDetailsResp = httpGET(api.collections + id, true, userAuth, bearer);

    if (!channelDetailsResp.isOk)
        throw new ScriptException(`Failed to retrieve details for collection ${id} [${channelDetailsResp.code}]`);

    const details = JSON.parse(channelDetailsResp.body);
    collectionDetailsCache.set(key, details);
    return details;
}

/**
 * Get videos within a collection
 * @param {number} id - Collection ID
 * @param {string} bearer - Bearer token
 * @param {number} page - Page number for pagination
 * @returns {object} Collection items response
 */
function getCollectionVideos(id, bearer, page) {
    let url = api.collections + id + '/items?sort=release_date';
    url = page && url + '&page=' + page || url;
    const videosResp = httpGET(url, true, false, bearer);
    
    if (!videosResp.isOk) 
        throw new ScriptException(`Failed to retrieve videos for collection ${url} [${videosResp.code}]`);

    return JSON.parse(videosResp.body);
}

/**
 * Fetch videos from the user's watchlist
 * @param {string} bearer - Bearer token
 * @param {string} userId - Customer/user ID
 * @param {number} page - Page number
 * @returns {{videos: PlatformVideo[], hasMore: boolean}}
 */
function getWatchlistVideos(bearer, userId, page) {
    const resp = httpGET(
        api.customers + userId + '/watchlist?product=' + WATCHLIST_PRODUCT_ID + '&collection=' + api.customers + userId + '/watchlist&per_page=' + WATCHLIST_PER_PAGE + '&include_products=true&page=' + page,
        true,
        true,
        bearer
    );

    if (!resp.isOk) 
        return { videos: [], hasMore: false };

    // Parse watchlist response
    const data = JSON.parse(resp.body);
    const items = data._embedded?.items ?? [];

    // Map watchlist items to PlatformVideo, normalizing field names to match getPlatformVideo expectations
    const videos = items.map(function (v) {
        // The watchlist API returns videos in a different shape than the standard video API,
        // so normalize the fields before passing to getPlatformVideo
        const channel = v.metadata?.series_id && getCollectionDetails(v.metadata.series_id, true, bearer);
        return getPlatformVideo({
            id: v.id,
            title: v.title || v.name,
            thumbnails: { "16_9": { medium: v.thumbnail?.medium } },
            metadata: { series: { id: v.metadata?.series_id ?? '', name: v.metadata?.series_name } },
            page_url: v._links?.video_page?.href || platform.url,
            created_at: v.created_at,
            duration: v.duration,
            live_video: v.live_video
        }, channel);
    });

    // Determine if more pages exist using total from response
    const hasMore = data.total ? (page * WATCHLIST_PER_PAGE) < data.total : false;
    return { videos, hasMore };
}

/**
 * Get a page of site categories.
 *
 * The categories endpoint returns both `category`- and `playlist`-type collections with each
 * one's id, title, page_url, thumbnails and site_id inline, so no per-item collection details
 * or page scraping is needed; only the category ones are returned here. (The previous hubs
 * endpoint needed three requests per item and its pagination was tracked with the wrong
 * page size.)
 * @param {number} page - Page number
 * @param {string} bearer - Bearer token
 * @returns {{results: PlatformPlaylist[], count: number}}
 */
function getCollectionLists(page, bearer) {
    bearer = bearer || getBearer();

    const collectionsResp = httpGET(
        `${api.categories}?page=${page}&per_page=${CATEGORIES_PER_PAGE}`,
        true,
        false,
        bearer
    );

    if (!collectionsResp.isOk)
        throw new ScriptException(`Failed to retrieve collections [${collectionsResp.code}]`);

    const data = JSON.parse(collectionsResp.body);
    // `/categories` lists both category- and playlist-type collections; the playlists tab
    // has always shown only the category ones (series have their own channel)
    const results = Object.values(data.categories ?? [])
        .filter(category => category.type == 'category')
        .map(category => getPlatformPlaylist(category));

    return {results, count: data.pagination?.count ?? results.length};
}

/**
 * Extract a detail from HTML using a regex capture group
 * @param {string} html - HTML content to search
 * @param {RegExp} regex - Regex pattern with one capture group
 * @returns {string|null} Captured value or null if no match
 */
function extractDetail(html, regex) {
    const match = html.match(regex);

    if (match) {
        return match[1];
    } else {
        return null;
    }
}

/**
 * Extract collection/series ID from a page URL by fetching and parsing
 * @param {string} url - Collection page URL
 * @returns {string|null} Collection ID or null
 */
function getSeriesId(url) {
    const seriesResp = httpGET(url, false, false);

    if (!seriesResp.isOk)
        throw new ScriptException(`Failed to get id from series ${url} [${seriesResp.code}]`);

    return extractDetail(seriesResp.body, regex.channelId);
}

// ============================== Pagers ==============================

class CommentsPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getComments(this.context.url, this.context.continuationToken);
    }
}

class SearchResultsPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        this.context.page++;
        const result = getSearchResults(this.context.page, this.context.query, 'video');
        this.results = result.results;
        this.hasMore = result.hasMore;
        return this;
    }
}

class SearchPlaylistsPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        this.context.page++;
        const result = getSearchResults(this.context.page, this.context.query, 'playlist');
        this.results = result.results;
        this.hasMore = result.hasMore;
        return this;
    }
}

class PlaylistContentsPager extends VideoPager {
    constructor(initialResults, hasMore, context) {
        super(initialResults, hasMore, context);
        this.page = 1;
    }

    async nextPage() {
        this.page++;
        // Do logic to check if there are any more pages after this one (boolean)
        this.hasMore = ((this.page * this.context.perPage ) < this.context.pages);
        if (this.hasMore) {
            const nextPageVideos = getPlaylistVideos(this.context.playlistId, this.page, this.context.bearer);
            this.results = nextPageVideos.videos;
        };
        return this;
    }
}

class CollectionListsPager extends VideoPager {
    constructor(initialResults, hasMore, context) {
        super(initialResults, hasMore, context);
        this.page = 1;
        this.resultsLeft = this.context.count;
    }

    async nextPage() {
        this.page++;

        // Do logic to check if there are any more pages after this one (boolean)
        this.hasMore = (this.page * this.context.perPage ) < this.context.count;
        this.resultsLeft = this.resultsLeft - this.context.perPage;

        // Check if there are any more pages or there is an odd number of collections left
        if (this.hasMore || this.resultsLeft > 0) {
            const nextPagePlaylists = getCollectionLists(this.page, this.context.bearer);
            this.results = nextPagePlaylists.results;        
        };

        return this;
    }
}

class WatchlistContentsPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
        this.page = 1;
    }

    nextPage() {
        this.page++;
        const result = getWatchlistVideos(this.context.bearer, this.context.userId, this.page);
        this.results = result.videos;
        this.hasMore = result.hasMore;
        return this;
    }
}

class SearchChannelsPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        this.context.page++;
        const result = getSearchResults(this.context.page, this.context.query, 'series');
        this.results = result.results;
        this.hasMore = result.hasMore;
        return this;
    }
}

class UncategorizedContentsPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    // The full sorted list is already in hand, so later pages are local slices
    nextPage() {
        this.context.page++;
        const start = this.context.page * UNCATEGORIZED_PER_PAGE;
        const end = start + UNCATEGORIZED_PER_PAGE;
        this.results = this.context.videos.slice(start, end);
        this.hasMore = end < this.context.videos.length;
        return this;
    }
}

class ChannelContentsPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }
    
    nextPage() {
        return source.getChannelContents(this.context.url, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
    }
}