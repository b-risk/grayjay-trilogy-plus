// Platform information
const platform = {
    title: 'Trilogy Plus',
    url: 'https://www.trilogyplus.com/',
    icon: 'https://dr56wvhu2c8zo.cloudfront.net/trilogyplus/assets/739ad5e0-ee07-4677-ac2b-c0c5ab40adb3.png',
    description: 'Trilogy Plus is an immersive streaming service with the best entertainment in scambaiting, scam-busting, travel and true crime.'
}

// API endpoints
const api = {
    base: 'https://api.vhx.com/v2/sites/156301/',
    comments: 'https://api.vhx.com/comments/',
    collections: 'https://api.vhx.com/v2/sites/156301/collections/',
    hubs: 'https://api.vhx.tv/hubs/1339808?product=https://api.vhx.tv/products/122755&per_page=7&page=',
    uiAvatars: 'https://ui-avatars.com/api/?color=ffffff&bold=true&format=png&size=128&length=1&background='
}

// Regex variables used for extracting details
const regex = {
    contentUrl: /^https:\/\/www\.trilogyplus\.com\/videos\/[^\/]+$/,
    collectionUrl: /^https:\/\/(?:www\.)?trilogyplus\.com\/[^\/]+$/,
    channelId: /"COLLECTION_ID":"?([^",]+)"?,"COLLECTION_TITLE"/,
    videoId: /"video","VIDEO_ID":(\d+)/,
    bearerToken: /window\.TOKEN\s*=\s*"([^"]+)";/m,
    userHasSub: /user_has_subscription:\s*"(\w+)"\s*,/,
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

let config = {};
let settings = {};

// Enable source
source.enable = function (conf, _settings) {
    config = conf;
    settings = _settings;
}

// Get home results
source.getHome = function() {
    return new HomePager(getHomeResults(0), false);
}

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
    const hasMore = false; // Are there more pages?
    const context = { query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SearchResultsPager(getSearchResults(1, query, 'video'), hasMore, context);
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
    const hasMore = false;
    const context = { query: query, continuationToken: continuationToken }; // Relevant data for the next page
    return new SearchChannelsPager(getSearchResults(1, query, 'series'), hasMore, context);
}

// Detect channel URL
source.isChannelUrl = function(url) {
    if (url == platform.url) { // Detect dummy channel with miscellaneous videos
        return true;
    } else if (regex.collectionUrl.test(url)) { // Detect collection series
        return getCollectionDetails(getSeriesId(url)).type == 'series';
    };
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
        const context = { perPage: 10, count: collectionLists.count, bearer };
        return new CollectionListsPager(collectionLists.results, hasMore, context);
    };
}

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
    const sourceDetails = httpGET(
        `https://api.vhx.tv/videos/${video.id}/files`, 
        true, 
        true,
        bearer
    );

    if (!sourceDetails.isOk) {
        // Detect failed request for sources, video must not be free or able to be viewed by the current user,
        // Can't use video.is_free as it always returns false whether or not the video is actually free
        if (sourceDetails.code == 402 || sourceDetails.code == 403)
            throw new LoginRequiredException('Subscription required for premium content');
        throw new ScriptException(`Failed to retrieve video details for video ID ${video.id} [${sourceDetails.code}]`);
    }
    
    // Get channel details, returns null if not part of series and dummy channel details are used
    const channel = video.metadata?.series_id != null && getCollectionDetails(video.metadata.series_id, userAuth, bearer);
    
    let sources = [];

    // Loop through video sources
    for (const source of Object.values(JSON.parse(sourceDetails.body))) {
        // Translate quality into width and height data
        const quality = supportedResolutions[source.quality];

        // Detect supported video formats
        if (source.method == "hls") {
            sources.push(new HLSSource({
                name: source.quality + '/' + source.mime_type,
                url: source._links.source.href,
                priority: true
            }));
        } else if (source.method == "progressive" && quality) {
            sources.push(new VideoUrlSource({
                width: quality.width,
                height: quality.height,
                container: source.mime_type,
                codec: source.codec,
                name: source.quality + '/' + source.mime_type,
                bitrate: ( source.size.bytes * 8 ) / video.duration.seconds,
                duration: video.duration.seconds,
                url: source._links.source.href
            }));
        }
    }
    
    // Return video details
    return new PlatformVideoDetails({
        id: new PlatformID(platform.title, String(video.id), config.id),
        name: video.name,
        thumbnails: new Thumbnails([new Thumbnail(video.thumbnail.source, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, String(video?.metadata.series_id), config.id),
            video?.metadata.series_name || "Trilogy Plus",
            channel?.page_url || platform.url,
            channel?.thumbnails?.["16_9"]?.large || platform.icon
        ),
        url: url,
        uploadDate: Math.round((new Date(video.created_at)).getTime() / 1000),
        duration: video.duration.seconds,
        viewCount: null,
        description: video.description,
        isLive: video.live_video,
        video: new VideoSourceDescriptor(sources)
    });
}

// Detect playlist url, for TrilogyPlus non-series collections are used as playlists
source.isPlaylistUrl = function (url) {
    if (regex.watchlistUrl.test(url)) {
        return true;
    } else if (regex.collectionUrl.test(url)) {
        const collectionType = getCollectionDetails(getSeriesId(url))?.type

        // Detect if collection is a playlist or home category
        return collectionType == 'playlist' || collectionType == 'category';
    }
}

// Get playlist
source.getPlaylist = function (url, id, bearer, page = 1) {
    if (regex.watchlistUrl.test(url)) {
        const userAuth = bridge.isLoggedIn();

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
    const playlist = getCollectionDetails(id, bearer);
    const playlistVideos = getPlaylistVideos(id, page, bearer);

    const context = {url: url, playlistId: id, bearer: bearer, pages: playlistVideos.pagination.count, perPage: playlistVideos.pagination.per_page};

    // Return playlist
    return new PlatformPlaylistDetails({
        id: new PlatformID(platform.title, String(playlist.id), config.id),
        name: playlist.title,
        thumbnails: new Thumbnails([new Thumbnail(playlist.thumbnails?.['16_9']?.large)]),
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
        thumbnail: playlist.thumbnails?.['16_9']?.large,
        contents: new PlaylistContentsPager(playlistVideos.videos, playlistVideos.pagination.count > playlistVideos.pagination.current, context)
    });
}

// Get user's playlists (for Import Playlists)
source.getUserPlaylists = function () {
    return [platform.url + 'watchlist'];
}

// Search playlists
source.searchPlaylists = function (query, type, order, filters, continuationToken) {
    const hasMore = false; // Are there more pages?
    const context = { query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SearchPlaylistsPager(getSearchResults(1, query, 'playlist'), hasMore, context);
}

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
    const params = {
        count: 5,
        offset: 0,
        parent_id: comment.context.id,
        sort_by: 'best',
        child_count: comment.replyCount ?? 0,
    };

    return getSubCommentsPager(comment.contextUrl, params, 1);
}

/**
 * Map a comment API object into a Comment instance
 * @param {object} comment - Comment data from API
 * @param {string} contextUrl - URL of the video the comment belongs to
 * @param {object} context - Context object (varies for top-level vs sub-comments)
 * @returns {Comment}
 */
function parseComment(comment, contextUrl, context) {
    let name = comment._embedded?.customer?.name;

    // Handle cases where comment author name doesn't exist, common for comments on TrilogyPlus
    if (!name || name == '')
        name = 'Anonymous'

    return new Comment({
        contextUrl: contextUrl || '',
        author: new PlatformAuthorLink(
            new PlatformID(platform.title, name, String(config.id ?? '')),
            name,
            '',
            getAvatar(comment._embedded?.customer?.thumbnail?.medium, name)
        ),
        message: String(comment.content ?? ''),
        rating: new RatingLikes(comment.like_count ?? 0),
        date: Math.max(0, parseInt((new Date(comment.created_at ?? 0)).getTime() / 1000)),
        replyCount: comment.comments_count ?? 0,
        context: context
    });
}

/**
 * Get paginated sub-comments for a comment
 * @param {string} contextUrl - URL of the parent video
 * @param {object} params - Request parameters (count, offset, parent_id, sort_by)
 * @param {number} page - Page number for pagination
 * @returns {CommentPager}
 */
function getSubCommentsPager(contextUrl, params, page) {
    // Retrieve sub comments
    const commentsResp = httpGET(
        api.comments + params.parent_id,
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

        if (!siteResp.isOk) {
            throw new ScriptException(`Failed to get bearer token [${siteResp.code}]`);
        };
        const bearer = extractDetail(siteResp.body, regex.bearerToken);
        if (!bearer || typeof(bearer) !== 'string') {
            throw new ScriptException(`Bearer token not found in HTML ${siteResp.body}`);
        };
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
    const thumbnail = (!playlistThumbnail || playlistThumbnail.includes('default')) && platform.icon || playlistThumbnail;
    return new PlatformPlaylist({
        id: new PlatformID(platform.title, playlist.id.toString(), config.id),
        author: new PlatformAuthorLink(
            new PlatformID(
                platform.title, 
                playlist.site_id.toString(), 
                config.id
            ), 
            platform.title, 
            platform.url, 
            platform.icon
        ),
        name: playlist.title,
        thumbnail: thumbnail || platform.icon,
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
        banner: channel?.thumbnails?.["16_6"]?.source || thumbnail,
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
function getPlaylistVideos(id, page, bearer = getBearer()) {
    const playlistVideos = getCollectionVideos(id, bearer, page);
    const results = [];

    for (const v of Object.values(playlistVideos.items)) {
        const video = v.entity;
        const channel = video.metadata?.series?.id && getCollectionDetails(video.metadata.series.id, false, bearer);
        if (video.type == 'video')
            results.push(getPlatformVideo(video, channel));
    }
    
    return {videos: results, pagination: playlistVideos.pagination};
}

/**
 * Get videos for the home feed or uncategorized (dummy) channel,
 * @param {number} page - Page index (0 = home feed, >0 = new releases)
 * @param {boolean} excludeCategorized - Exclude videos that belong to a series
 * @param {string} [query] - Optional search query to filter results
 * @returns {PlatformVideo[]}
 */
function getHomeResults(page, excludeCategorized = false, query)  {
    // Use specified home feed from settings, 
    // if excludeCategorized is enabled then it should only be the new releases feed for the dummy channel
    const collectionId = excludeCategorized && 1 || settings.homeFeedSource;

    const bearer = getBearer();

    const homeResp = httpGET(
        api.collections + homepageIds[collectionId] + '/items', 
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

        // An extra request is required for each video due to the feed API not having accurate data if videos are a part of series
        const channel = entity.metadata?.series?.id != null && getCollectionDetails(entity.metadata?.series?.id, false, bearer)

        // Exclude videos that are a part of a series (for the uncategorized channel)
        if (excludeCategorized && channel)
            continue;

        // Check if it matches the query (for channel search)
        if (query && entity.title.toLowerCase().includes(query.toLowerCase()) || !query)
            results.push(getPlatformVideo(entity, channel));
    }

    return results;
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

    // Check if channel is the non-series (dummy) channel, then return the uncategorized videos
    if (url == platform.url )
        return new ChannelContentsPager(getHomeResults(0, true, query), hasMore, context);

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
 * Search for videos, series, or playlists
 * @param {number} page - Page number
 * @param {string} query - Search query string
 * @param {string} returnType - Type of results ('video', 'series', or 'playlist')
 * @returns {Array<PlatformVideo|PlatformChannel|PlatformPlaylist>}
 */
function getSearchResults(page, query, returnType) {
    // Determine which query parameter to use, it will be by collection if the returnType is for a series or playlist
    const searchType = ((returnType == 'series' || returnType == 'playlist') && 'collection') || returnType

    const bearer = getBearer()
    
    const searchResp = httpGET(
        `${api.base}search?q=${query}&type=${searchType}&page=${page}`,
        true, 
        false,
        bearer
    );
    
    if (!searchResp.isOk)
        throw new ScriptException(`Search type ${searchType} failed with code [${searchResp.code}]`);

    const responseResults = JSON.parse(searchResp.body).results

    const results = [];

    // Make an extra check for the uncategorized channel to be included in channel search
    if (returnType == 'series') {
        // Add uncategorized channel "Trilogy Plus" if search query matches
        if (platform.title.toLowerCase().includes(query.toLowerCase()))
            results.push(getPlatformChannel());
    }
    
    // Loop through results
    for (const e of Object.values(responseResults)) {
        const entity = e.entity

        // Detect content type
        if (entity.type == returnType) {
            if (returnType == 'series') {
                results.push(getPlatformChannel(entity));
            } else if (returnType == 'playlist') {
                results.push(getPlatformPlaylist(entity));
            } else if (returnType == 'video') {
                const channel = entity.metadata?.series?.id != null && getCollectionDetails(entity.metadata?.series?.id, false, bearer);

                results.push(getPlatformVideo(entity, channel));
            }
        }
    }

    return results;
}

/**
 * Get avatar URL for a comment author
 * @param {string} [avatar] - Avatar URL from the API
 * @param {string} [name] - Author name for generating fallback avatar
 * @returns {string} Avatar URL
 */
function getAvatar(avatar, name) {
    if (avatar && avatar.includes('blank')) {
        // Avatar is miscellaneous, return generated avatar using UI Avatars API
        return `${api.uiAvatars}${stringToHexColor(name)}&name=${name.replace(/ /g, '+')}`;
    } else if (avatar) {
        // Avatar is valid, return self
        return avatar
    } else {
        // Return platform icon in the worst case scenario
        return platform.icon
    }
}

/**
 * Make an authenticated HTTP GET request
 * @param {string} url - Request URL
 * @param {boolean} useMethod - Whether to include Authorization and Accept headers
 * @param {boolean} useAuth - Whether to use stored authentication
 * @param {string} bearer - Bearer token
 * @returns {object} HTTP response object
 */
function httpGET(url, useMethod, useAuth, bearer = getBearer()) {
    const method = useMethod && { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: platform.url 
        } || {};
    
    const response = http.GET(url, method, useAuth);

    return response;
}

/**
 * Convert a string to a hex color code for avatar backgrounds
 * @param {string} str - Input string
 * @returns {string} Hex color string (6 digits)
 */
function stringToHexColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Convert hash to a 6-digit hex string
    const color = (hash & 0x00FFFFFF).toString(16).padStart(6, '0');
    return color;
}

/**
 * Get video details from a video page URL
 * @param {string} url - Video page URL
 * @param {string} bearer - Bearer token
 * @param {boolean} useAuth - Whether to use authenticated requests
 * @returns {object} Video details from API with added user_has_sub field
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

    const videoDetailsResp = httpGET(
        `https://api.vhx.tv/videos/${id}`, 
        true, 
        useAuth,
        bearer
    );

    if (!videoDetailsResp.isOk)
        throw new ScriptException(`Failed to retrieve video details [${videoDetailsResp.code}]`);

    const details = JSON.parse(videoDetailsResp.body);

    details.user_has_sub = extractDetail(videoResp.body, regex.userHasSub);

    return details;
}

/**
 * Get collection (series/playlist) details by ID
 * @param {number} id - Collection ID
 * @param {boolean} userAuth - Whether to use authentication
 * @param {string} bearer - Bearer token
 * @returns {object} Collection details
 */
function getCollectionDetails(id, userAuth, bearer) {
    const channelDetailsResp = httpGET(api.collections + id, true, userAuth, bearer);

    if (!channelDetailsResp.isOk)
        throw new ScriptException(`Failed to retrieve details for collection ID ${id} [${channelDetailsResp.code}]`);

    return JSON.parse(channelDetailsResp.body);
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
        'https://api.vhx.tv/customers/' + userId + '/watchlist?product=122755&collection=https://api.vhx.tv/customers/' + userId + '/watchlist&per_page=12&include_products=true&page=' + page,
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

    // Determine if more pages exist using total from response (per_page is always 12)
    const hasMore = data.total ? (page * 12) < data.total : false;
    return { videos, hasMore };
}

/**
 * Get list of collections (categories) from hubs
 * @param {number} page - Page number
 * @param {string} bearer - Bearer token
 * @returns {{results: PlatformPlaylist[], count: number}}
 */
function getCollectionLists(page, bearer = getBearer()) {
    const collectionsResp = httpGET(api.hubs + page, true, false, bearer);

    if (!collectionsResp.isOk)
        throw new ScriptException(`Failed to retrieve collections [${collectionsResp.code}]`);

    const collections = JSON.parse(collectionsResp.body);

    const results = [];

    for (const collection of Object.values(collections._embedded?.items ?? [])) {
        const collectionInfo = getCollectionDetails(getSeriesId(collection._links.collection_page.href), false, bearer);
        
        if (collectionInfo.type == 'category')
            results.push(getPlatformPlaylist(collectionInfo));
    }

    return {results, count: collections.total};
};

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

class CommentsPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getComments(this.context.url, this.context.continuationToken);
    }
}

class HomePager extends VideoPager {
	constructor(initialResults, hasMore) {
		super(initialResults, hasMore);
        this.page = 0;
	}
	
	nextPage() {
        this.page++;
        this.results = getHomeResults(this.page);
        this.hasMore = false;
		return this;
	}
}

class SearchResultsPager extends VideoPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.search(this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
	}
}

class SearchPlaylistsPager extends VideoPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.searchPlaylists(this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
	}
}

class PlaylistContentsPager extends VideoPager {
    constructor(initialResults, hasMore, context) {
        super(initialResults, hasMore, context);
        this.page = 1;
    };

    async nextPage() {
        this.page++;
        // Do logic to check if there are any more pages after this one (boolean)
        this.hasMore = ((this.page * this.context.perPage ) < this.context.pages);
        if (this.hasMore) {
            const nextPageVideos = getPlaylistVideos(this.context.playlistId, this.page, this.context.bearer);
            this.results = nextPageVideos.videos;
        };
        return this;
    };
};

class CollectionListsPager extends VideoPager {
    constructor(initialResults, hasMore, context) {
        super(initialResults, hasMore, context);
        this.page = 1;
        this.resultsLeft = this.context.count;
    };

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
    };
};

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
		return source.searchChannels(this.context.query, this.context.continuationToken);
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