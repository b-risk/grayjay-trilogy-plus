// Platform information
const PLATFORM = 'Trilogy Plus';
const URL_PLATFORM = 'https://www.trilogyplus.com/';

// Redundant, removing soon
const ICON_TRILOGYPLUS = 'https://dr56wvhu2c8zo.cloudfront.net/trilogyplus/assets/739ad5e0-ee07-4677-ac2b-c0c5ab40adb3.png';

const API = 'https://api.vhx.com/'
const API_BASE = API + 'v2/sites/156301/'

const URLS = {
    PLATFORM: 'https://www.trilogyplus.com/',
    ICON: 'https://dr56wvhu2c8zo.cloudfront.net/trilogyplus/assets/739ad5e0-ee07-4677-ac2b-c0c5ab40adb3.png',
    APIS: {
        UI_AVATARS: 'https://ui-avatars.com/api/?color=fffffff&bold=true&format=png&size=128&length=1&background=random&name=',
        HUBS: 'https://api.vhx.tv/hubs/1339808?product=https://api.vhx.tv/products/122755&per_page=7&page=',
        COLLECTIONS: API_BASE + 'collections/',
        COMMENTS: API + 'comments/'
    }
};
const API_COLLECTIONS = API_BASE + 'collections/' // Redundant, removing soon
const API_COLLECTIONS_VIDEOS = API_COLLECTIONS + 'ID/items' // Redundant, removing soon
const API_UI_AVATARS = 'https://ui-avatars.com/api/?color=fffffff&bold=true&format=png&size=128&length=1&background=random&name=' // Redundant, removing soon

const HOMEPAGE_IDS = [
    1067129, // Free Videos
    1491720, // New Releases
	1480905 // Popular
];

// Regex variables for extracting metadata
const REGEX = {
    CONTENT: /^https:\/\/www\.trilogyplus\.com\/videos\/[^\/]+$/,
    COLLECTION: /^https:\/\/(?:www\.)?trilogyplus\.com\/[^\/]+$/,
    CHANNEL_ID: /"COLLECTION_ID":"?([^",]+)"?,"COLLECTION_TITLE"/,
    VIDEO_ID: /"video","VIDEO_ID":(\d+)/,
    BEARER_TOKEN: /window\.TOKEN\s*=\s*"([^"]+)";/m
};
const REGEX_COLLECTION_URL = /^https:\/\/(?:www\.)?trilogyplus\.com\/[^\/]+$/; // Redundant, removing soon
const REGEX_CHANNEL_ID = /"COLLECTION_ID":"?([^",]+)"?,"COLLECTION_TITLE"/; // Redundant, removing soon
const REGEX_VIDEO_ID = /"video","VIDEO_ID":(\d+)/; // Redundant, removing soon
const REGEX_BEARER_TOKEN = /window\.TOKEN\s*=\s*"([^"]+)";/m; // Redundant, removing soon

const supportedResolutions = {
    '1440p': { width: 2560, height: 1440 },
	'1080p': { width: 1920, height: 1080 },
	'720p': { width: 1280, height: 720 },
    '540p': { width: 960, height: 540 },
	'480p': { width: 854, height: 480 },
	'360p': { width: 640, height: 360 },
	'240p': { width: 426, height: 240 },
	'144p': { width: 256, height: 144 }
};


let config = {};
let settings = {};

source.enable = function (conf, _settings) {
    config = conf;
    settings = _settings;
}

source.getHome = function() {
    return new HomePager(getHomeResults(0), false);
}

source.searchSuggestions = function(query) {
    /**
     * @param query: string
     * @returns: string[]
     */

    const suggestions = []; //The suggestions for a specific search query
    return suggestions;
}

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

source.search = function (query, type, order, filters, continuationToken) {
    const videos = getSearchResults(1, query, 'video');

    const hasMore = false; // Are there more pages?
    const context = { query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeSearchVideoPager(videos, hasMore, context);
}

source.getSearchChannelContentsCapabilities = function () {
    //This is an example of how to return search capabilities on a channel like available sorts, filters and which feed types are available (see source.js for more details)
	return {
		types: [Type.Feed.Mixed],
		sorts: [Type.Order.Chronological],
		filters: []
	};
}

source.searchChannelContents = function (url, query, type, order, filters, continuationToken) {
    /**
     * @param url: string
     * @param query: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */

    const videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { channelUrl: channelUrl, query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeSearchChannelVideoPager(videos, hasMore, context);
}

source.searchChannels = function (query, continuationToken) { // Needs to be improvd, currently returns all channels on the platform even if not relevent
    const hasMore = false;
    const context = { query: query, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeChannelPager(getSearchResults(1, query, 'series'), hasMore, context);
}

source.isChannelUrl = function(url) {
    if (url == URL_PLATFORM) {
        return true;
    } else if (REGEX_COLLECTION_URL.test(url)) {
        return getCollectionDetails(getSeriesId(url)).type == 'series';
    };
}

source.getChannel = function(url) {
    const channel = (url !== URL_PLATFORM) && getCollectionDetails(getSeriesId(url), getBearer());

	return new PlatformChannel({
        id: new PlatformID(PLATFORM, String(channel?.id), config.id),
        name: channel?.title || PLATFORM,
        thumbnail: channel?.thumbnails?.["1_1"]?.medium || ICON_TRILOGYPLUS,
        banner: channel?.thumbnails?.["16_6"]?.source || ICON_TRILOGYPLUS,
        subscribers: null,
        description: channel?.description || "Trilogy Plus is an immersive streaming service with the best entertainment in scambaiting, scam-busting, travel and true crime.",
        url: channel?.page_url || URL_PLATFORM,
        links: {}
    })
}

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    let hasMore = false; // Are there more pages?
    let context = { url: url, query: null, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    

    // Check if channel is uncategorized (not part of any series,) then return the uncategorized videos
    if (url == URL_PLATFORM ) {
        return new SomeChannelVideoPager(getHomeResults(0, true), hasMore, context);
    };

    const bearer = getBearer();
    const channelResp = httpGET(url, false, false, bearer);
    const id = extractDetail(channelResp.body, REGEX_CHANNEL_ID);

    const channel = id && getCollectionDetails(id, bearer);  

    const seasonsResp = httpGET(`${API_COLLECTIONS}${id}/items`, true, false, bearer);

    if (!seasonsResp.isOk) {
        throw new ScriptException(`Failed to retrieve series seasons [${seasonsResp.code}]`);
    };

    // Seasons, in reverse order from newest to oldest
    const seasons = JSON.parse(seasonsResp.body).items.reverse()

    let videos = []; // The results (PlatformVideo)

    for (const season of Object.values(seasons)) {
        const seasonResp = httpGET(`${API_COLLECTIONS}${season.entity.id}/items`, true, false, bearer);
    
        if (!seasonResp.isOk) 
            throw new ScriptException(`Failed to retrieve channel season details [${seasonResp.code}]`)

        const channelVideos = JSON.parse(seasonResp.body).items.reverse(); // Videos, in reverse order from newest to oldest
        
        for (const v of Object.values(channelVideos)) {
            const video = v.entity;
            videos.push(new PlatformVideo({
                id: new PlatformID(PLATFORM, String(video.id), config.id),
                name: video.title,
				thumbnails: new Thumbnails([new Thumbnail(video.thumbnails["16_9"].large, 0)]),
				author: new PlatformAuthorLink(
					new PlatformID(PLATFORM, video.metadata.series.id, config.id),
					video.metadata.series.name,
					url,
					channel.thumbnails["1_1"].medium
				),
				datetime: Math.round((new Date(video.created_at)).getTime() / 1000),
				duration: video.duration.seconds,
				viewCount: null,
				url: video.page_url,
				isLive: video.live_video
		    }));
        };
    };

    return new SomeChannelVideoPager(videos, hasMore, context);
};

source.getChannelPlaylists = function(url) {
    if (url == URLS.PLATFORM) {
        const bearer = getBearer();
        const collectionLists = getCollectionLists(true, 1, bearer);
        const hasMore = true;
        const context = { perPage: 10, count: collectionLists.count, bearer };
        return new CollectionListsPager(collectionLists.results, hasMore, context);
    };
};

source.isContentDetailsUrl = function(url) {
	return REGEX.CONTENT.test(url);
};

source.getContentDetails = function(url) {
    const video = getVideoDetails(url);

    const userHasSub = true;

    if (!bridge.isLoggedIn()) {
        throw new LoginRequiredException('Login required for Trilogy Plus content');
    } else if (!userHasSub && !video.is_free) {
        throw new LoginRequiredException('Login required for premium content');
    };

    const sourceDetails = httpGET(
        `https://api.vhx.tv/videos/${video.id}/files`, 
        true, 
        true
    );

    if (!sourceDetails.isOk)
        throw new ScriptException(`Failed to retrieve video details for video ID ${video.id} [${sourceDetails.code}]`);
    
    const channel = video.metadata.series_id !== undefined && getCollectionDetails(video.metadata.series_id, video.bearer);
    let sources = [];

    // Loop through video sources
    for (const source of Object.values(JSON.parse(sourceDetails.body))) {
        const quality = supportedResolutions[source.quality];
        if (source.method == "hls") {
            sources.push(new HLSSource({
                name: source.quality + '/' + source.mime_type,
                url: source._links.source.href,
                priority: true
            }));
        } else if (source.method == "progressive" && quality) {
            new VideoUrlSource({
                width: quality.width,
                height: quality.height,
                container: source.mime_type,
                codec: source.codec,
                name: source.quality + '/' + source.mime_type,
                bitrate: ( source.size.bytes * 8 ) / video.duration.seconds,
                duration: video.duration.seconds,
                url: source._links.source.href
            });
        }
    }
    
    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, String(video.id), config.id),
        name: video.name,
        thumbnails: new Thumbnails([new Thumbnail(video.thumbnail.source, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, String(video?.metadata.series_id), config.id),
            video?.metadata.series_name || "Trilogy Plus",
            channel?.page_url || URL_PLATFORM,
            channel?.thumbnails?.["16_9"].large || ICON_TRILOGYPLUS
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

source.isPlaylistUrl = function (url) {
    if (REGEX_COLLECTION_URL.test(url)) {
        const collectionType = getCollectionDetails(getSeriesId(url)).type
        return collectionType == 'playlist' || collectionType == 'category';
    };
}

source.getPlaylist = function (url, id, bearer = getBearer(), page = 1) {
    id = !id && getSeriesId(url) || id
    const playlist = getCollectionDetails(id, bearer);
    const playlistVideos = getPlaylistVideos(id, page, bearer);

    const videos = playlistVideos.videos;

    const context = {url: url, playlistId: id, bearer: bearer, pages: playlistVideos.pagination.count, perPage: playlistVideos.pagination.per_page};

    return new PlatformPlaylistDetails({
        id: new PlatformID(PLATFORM, String(playlist.id), config.id),
        name: playlist.title,
        thumbnails: new Thumbnails([new Thumbnail(playlist.thumbnails?.['16_9']?.large)]),
        author: new PlatformAuthorLink(
            new PlatformID(
                PLATFORM, 
                null, 
                config.id
            ), 
            PLATFORM, 
            URL_PLATFORM, 
            ICON_TRILOGYPLUS,
        ),
        url,
        thumbnail: playlist.thumbnails?.['16_9']?.large,
        contents: new PlaylistContentsPager(videos, playlistVideos.pagination.count > playlistVideos.pagination.current, context)
    });
};

source.searchPlaylists = function (query, type, order, filters, continuationToken) {
    const playlists = getSearchResults(1, query, 'playlist');

    const hasMore = false; // Are there more pages?
    const context = { query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeSearchPlaylistsPager(playlists, hasMore, context);
}

source.getComments = function (url, continuationToken) {
    const video = getVideoDetails(url);
    
    const commentsResp = httpGET(video._links.comments.href, true, false, video.bearer);

    if (!commentsResp.isOk)
        throw new ScriptException(`Failed to retrieve comments [${commentsResp.code}]`);

    // Map comments
	const comments = JSON.parse(commentsResp.body)?._embedded?.comments?.map(comment => {
		const c = new Comment({
			contextUrl: url,
			author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, comment._embedded?.customer?.name, config.id),
				comment._embedded?.customer?.name ?? "",
				null,
				!comment._embedded?.customer?.thumbnail?.medium.includes('blank') 
                && comment._embedded?.customer?.thumbnail?.medium 
                || generateAvatar(comment._embedded?.customer?.name ?? "") 
                || ICON_TRILOGYPLUS // Handle cases if avatar doesn't exist
            ),
			message: comment.content ?? "",
			date: parseInt((new Date(comment.created_at)).getTime() / 1000),
			replyCount: comment.comments_count,
			context: { claimId: null, commentId: comment.id, isMembersOnly: null }
		});
		return c;
	}) ?? [];

    const hasMore = false; // Are there more pages?
    const context = { url: url, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeCommentPager(comments, hasMore, context);
};

source.getSubComments = function (comment) {
    const commentsResp = httpGET(
        URLS.APIS.COMMENTS + comment.context.commentId,  
        true,
        false
    );

    if (!commentsResp.isOk)
        throw new ScriptException(`Failed to retrieve comments [${commentsResp.code}]`);

    // Map comments
	const comments = JSON.parse(commentsResp.body)._embedded.comments.map(comment => {
		const c = new Comment({
			contextUrl: url,
			author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, comment._embedded?.customer?.name, config.id),
				comment._embedded?.customer?.name ?? "",
				null,
				!comment._embedded?.customer?.thumbnail?.medium.includes('blank') 
                && comment._embedded?.customer?.thumbnail?.medium 
                || generateAvatar(comment._embedded?.customer?.name ?? "") 
                || ICON_TRILOGYPLUS // Handle cases if avatar doesn't exist
            ),
			message: comment.content ?? "",
			date: parseInt((new Date(comment.created_at)).getTime() / 1000),
			replyCount: comment.comments_count,
			context: { claimId: null, commentId: comment.id, isMembersOnly: null }
		});
		return c;
	}) ?? [];

    const hasMore = false; // Are there more pages?
    const context = { url: url, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeCommentPager(comments, hasMore, context);
};

function getBearer(useAuth, html) {
    if (html) {
        return extractDetail(html, REGEX_BEARER_TOKEN);
    } else {
        const siteResp = http.GET(URL_PLATFORM + 'browse', {}, useAuth || false);

        if (!siteResp.isOk) {
            throw new ScriptException(`Failed to get bearer token [${siteResp.code}]`);
        };
        const bearer = extractDetail(siteResp.body, REGEX_BEARER_TOKEN);
        if (!bearer || typeof(bearer) !== 'string') {
            throw new ScriptException(`Bearer token not found in HTML ${siteResp.body}`);
        };
        return bearer;
    };
};

function getPlatformPlaylist(playlist) {
    const playlistThumbnail = playlist.thumbnails?.['16_9']?.medium;
    // Handle cases where thumbnail is nonexistant, mainly in the case of categories
    const thumbnail = (playlistThumbnail.includes('default') || !playlistThumbnail) && ICON_TRILOGYPLUS || playlistThumbnail;
    return new PlatformPlaylist({
        id: new PlatformID(PLATFORM, playlist.id.toString(), config.id),
        author: new PlatformAuthorLink(
            new PlatformID(
                PLATFORM, 
                playlist.site_id.toString(), 
                config.id
            ), 
            PLATFORM, 
            URL_PLATFORM, 
            ICON_TRILOGYPLUS
        ),
        name: playlist.title,
        thumbnail: thumbnail || ICON_TRILOGYPLUS,
        videoCount: playlist.videos_count,
        url: playlist.page_url
    });
};

function getPlatformVideo(video, channel) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, String(video.id), config.id),
        name: video.title,
        thumbnails: new Thumbnails([new Thumbnail(video.thumbnails["16_9"].medium, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, String(video.metadata?.series?.id), config.id),
            video.metadata?.series?.name || PLATFORM,
            channel?.page_url || URL_PLATFORM,
            channel?.thumbnails?.["16_9"]?.medium || ICON_TRILOGYPLUS
        ),
        datetime: parseInt((new Date(video.created_at)).getTime() / 1000),
        duration: video.duration?.seconds,
        viewCount: null,
        url: video.page_url,
        shareUrl: video.page_url,
        isLive: video.live_video
    });
};

function getPlaylistVideos(id, page, bearer = getBearer()) {
    const playlistVideos = getCollectionVideos(id, bearer, page);
    const results = [];

    for (const v of Object.values(playlistVideos.items)) {
        const video = v.entity;
        const channel = video.metadata?.series?.id && getCollectionDetails(video.metadata.series.id, bearer);
        if (video.type == 'video') {
            results.push(new PlatformVideo({
                id: new PlatformID(PLATFORM, String(video.id), config.id),
                name: video.title,
                thumbnails: new Thumbnails([new Thumbnail(video.thumbnails["16_9"].large, 0)]),
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, video.metadata?.series?.id, config.id),
                    video.metadata?.series?.name || PLATFORM,
                    channel?.page_url || URL_PLATFORM,
                    channel?.thumbnails?.["1_1"]?.medium || ICON_TRILOGYPLUS
                ),
                datetime: Math.round((new Date(video.created_at)).getTime() / 1000),
                duration: video.duration.seconds,
                viewCount: null,
                url: video.page_url,
                isLive: video.live_video
            }));
        };
    };
    
    return {videos: results, pagination: playlistVideos.pagination};
};

function getHomeResults(page, excludeCategorized = false, html)  {
    const collectionId = excludeCategorized && 1 || settings.homeFeedSource;
    const bearer = getBearer(false, html);
    const homeResp = httpGET(
        API_COLLECTIONS_VIDEOS.replace('ID', HOMEPAGE_IDS[collectionId]), 
        true, 
        false,
        bearer
    );

    if (!homeResp.isOk) {
        const siteResp = httpGET(URL_PLATFORM  + 'browse', false, true, bearer);
        throw new CaptchaRequiredException(URL_PLATFORM + 'browse', siteResp.body);
    };

    const results = [];

    for (const e of Object.values(JSON.parse(homeResp.body).items)) {
        const entity = e.entity;

        // Exclude series (channels) from home results
        if (entity.type == 'series' ) {
            continue;
        } 
        const channel = entity.metadata?.series?.id !== null && getCollectionDetails(entity.metadata?.series?.id, bearer)

        // Exclude videos that are a part of a series (for the uncategorized channel)
        if (excludeCategorized && channel) {
            continue;
        };

        results.push(getPlatformVideo(entity, channel));
    };

    return results;
}

function getSearchResults(page, query, returnType, bearer = getBearer()) {
    // Decide which query parameter to use
    const searchType = ((returnType == 'series' || returnType == 'playlist') && 'collection') || returnType
    
    const searchResp = httpGET(
        `${API_BASE}search?q=${query}&type=${searchType}&page=${page}`,
        true, 
        false,
        bearer
    );
    
    if (!searchResp.isOk) {
        throw new ScriptException(`Search type ${searchType} failed with code [${searchResp.code}]`);
    }

    const responseResults = JSON.parse(searchResp.body).results

    const results = [];

    if (returnType == 'series') {
        // Add uncategorized channel "Trilogy Plus" if search query matches
        if (PLATFORM.toLowerCase().includes(query.toLowerCase())) {
            results.push(new PlatformChannel({
                id: new PlatformID(PLATFORM, null, config.id),
                name: PLATFORM,                    
                thumbnail: ICON_TRILOGYPLUS,
                banner: ICON_TRILOGYPLUS,
                subscribers: null,
                description: "Trilogy Plus is an immersive streaming service with the best entertainment in scambaiting, scam-busting, travel and true crime.",
                url: URL_PLATFORM,
                links: {}
            }));
        };
    };
        
    for (const e of Object.values(responseResults)) {
        const entity = e.entity
        if (entity.type == returnType) {
            if (returnType == 'series') {
                results.push(new PlatformChannel({
                    id: new PlatformID(PLATFORM, entity.id.toString(), config.id),
                    name: entity.title,
                    thumbnail: entity.thumbnails["1_1"]?.medium,
                    banner: entity.thumbnails["16_6"]?.source,
                    subscribers: null,
                    description: entity.description,
                    url: entity.page_url,
                    links: {}
                }));
            } else if (returnType == 'playlist') {
                results.push(getPlatformPlaylist(entity));
            } else if (returnType == 'video') {
                const channel = entity.metadata?.series?.id !== null && getCollectionDetails(entity.metadata?.series?.id, bearer);

                results.push(getPlatformVideo(entity, channel));
            };
        };
    };

    return results;
};

// Helper: Make HTTP requests
function httpGET(url, useMethod, useAuth, bearer = getBearer(true)) {
    const method = useMethod && { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        } || {};
    
    const response = http.GET(url, method, useAuth);

    return response;
};

// Helper: Generate image for miscellaneous avatars in comments
function generateAvatar(name) {
    return API_UI_AVATARS + name.replace(/ /g, '+');
};

// Helper: Get video details from given url
function getVideoDetails(url, bearer = getBearer()) {
    const videoResp = http.GET(
        url, 
        { 
            Authorization: `Bearer ${bearer}`,
            Referer: URL_PLATFORM 
        }, 
        true
    );
    
    if (!videoResp.isOk) 
        throw new ScriptException(`Failed to retrieve video ${url} [${videoResp.code}]`)
    
    const id = extractDetail(videoResp.body, REGEX_VIDEO_ID);

    const videoDetailsResp = http.GET(
        `https://api.vhx.tv/videos/${id}`, 
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );

    if (!videoDetailsResp.isOk)
        throw new ScriptException(`Failed to retrieve video details [${videoDetailsResp.code}]`);

    const details = JSON.parse(videoDetailsResp.body)

    details.bearer = bearer
    return details
}

function getCollectionDetails(id, bearer = getBearer()) {
    const channelDetailsResp = httpGET(URLS.APIS.COLLECTIONS + id, true, false, bearer);

    if (!channelDetailsResp.isOk) {
        throw new ScriptException(`Failed to retrieve details for collection ID ${id} [${channelDetailsResp.code}]`);
    };

    return JSON.parse(channelDetailsResp.body);
};

function getCollectionVideos(id, bearer, page) {
    let url = URLS.APIS.COLLECTIONS + id + '/items?sort=release_date';
    url = page && url + '&page=' + page || url;
    const videosResp = httpGET(url, true, false, bearer);
    
    if (!videosResp.isOk)  {
        throw new ScriptException(`Failed to retrieve videos for collection ${url} [${videosResp.code}]`);
    };

    return JSON.parse(videosResp.body);
};

function getCollectionLists(excludeCategorized, page, bearer = getBearer()) {
    const collectionsResp = httpGET(URLS.APIS.HUBS + page, true, false, bearer);

    if (!collectionsResp.isOk)  {
        throw new ScriptException(`Failed to retrieve collections [${collectionsResp.code}]`);
    };

    const collections = JSON.parse(collectionsResp.body);

    const results = [];

    for (const collection of Object.values(collections._embedded.items)) {
        const collectionInfo = getCollectionDetails(getSeriesId(collection._links.collection_page.href), bearer);
        if (collectionInfo.type == 'category') {
            results.push(getPlatformPlaylist(collectionInfo));
        };
    };

    return {results, count: collections.total};
};

// Helper: Extract detail using regex
function extractDetail(html, regex) {
    const match = html.match(regex);

    if (match) {
        return match[1];
    } else {
        return null;
    };
}

// Helper: Extract series ID from URL
function getSeriesId(url) {
    const seriesResp = httpGET(url, false, false, null);

    if (!seriesResp.isOk) {
        throw new ScriptException(`Failed to get id from series ${url} [${seriesResp.code}]`);
    };

    return extractDetail(seriesResp.body, REGEX_CHANNEL_ID);
};

class SomeCommentPager extends CommentPager {
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
        this.hasMore = true;
		return this;
	}
}

class SearchVideoPager extends VideoPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.search(this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
	}
}

class SomeSearchVideoPager extends VideoPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.search(this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
	}
}

class SomeSearchPlaylistsPager extends VideoPager {
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
        if (this.hasMore || this.context.perPage - this.resultsLeft > 0) {
            const nextPagePlaylists = getCollectionLists(true, this.page, this.context.bearer);
            this.results = nextPagePlaylists.results;        
        };

        return this;
    };
};

class SomeChannelPager extends ChannelPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.searchChannelContents(this.context.query, this.context.continuationToken);
	}
}

class SomeChannelVideoPager extends VideoPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.getChannelContents(this.context.url, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
	}
}