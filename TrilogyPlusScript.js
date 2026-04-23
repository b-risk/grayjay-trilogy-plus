// Platform information
const PLATFORM = 'Trilogy Plus'
const URL_PLATFORM = 'https://www.trilogyplus.com/';

// Image used for channels (specific series images not yet supported)
const ICON_TRILOGYPLUS = "https://dr56wvhu2c8zo.cloudfront.net/trilogyplus/assets/739ad5e0-ee07-4677-ac2b-c0c5ab40adb3.png";

const API_BASE = 'https://api.vhx.com/v2/sites/156301/'
const API_COLLECTIONS = API_BASE + 'collections/'
const API_COLLECTIONS_VIDEOS = API_COLLECTIONS + 'ID/items'

// API for generating miscellaneous comment avatars
const API_UI_AVATARS = 'https://ui-avatars.com/api/?color=fffffff&bold=true&format=png&size=128&length=1&background=random&name='

// URLs handling different pages for content
const URL_NEWRELEASES = API_COLLECTIONS + '1491720/items?include_products_for=web&per_page=12&include_events=1&include_coming_soon=1';
const URL_FULLSHOWS = API_COLLECTIONS + '1080914/items'
const URL_CHANNELVIDEOS = API_COLLECTIONS + '1021973/item'

// Regex metadata
const REGEX_DETAILS_URL = /^https:\/\/www\.trilogyplus\.com\/videos\/[^\/]+$/;
const REGEX_COLLECTION_URL = /^https:\/\/www\.trilogyplus\.com\/[^\/]+$/;
const REGEX_CHANNEL_ID = /"COLLECTION_ID":"?([^",]+)"?,"COLLECTION_TITLE"/;
const REGEX_VIDEO_URL = /embed_url:\s*"([^"]*)"/;
const REGEX_VIDEO_ID = /"video","VIDEO_ID":(\d+)/;
const REGEX_VIDEO_COMMENTS_ID = /window\.COMMENTABLE_ID\s*=\s*(\w+)/i;
const REGEX_VIDEO_TITLE = /<meta\s+property="og:title"\s+content="([^"]*)"/i; // Unused

const REGEX_BEARER_TOKEN = /window\.TOKEN\s*=\s*"([^"]+)";/m;

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

source.enable = function (conf) {
    config = conf;
}

source.getHome = function() {
    return new HomePager(getHomeResults(0), true);
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
        return  getCollectionDetails(getSeriesId(url)).type == 'series';
    };
}

source.getChannel = function(url) {
    let channel = (url !== URL_PLATFORM) && getCollectionDetails(getSeriesId(url), getBearer());

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
    const channelResp = http.GET(url, {}, true);

    if (!channelResp.isOk) 
        throw new ScriptException(`Failed to retrieve channel page details [${channelResp.code}]`)

    const id = extractDetail(channelResp.body, REGEX_CHANNEL_ID)
    const bearer = getBearer(channelResp.body)

    const channel = id && getCollectionDetails(id, bearer);  

    let videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { url: url, query: null, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page

    if (url == URL_PLATFORM ) { // Check if channel is uncategorized (not part of any series,) then return the uncategorized videos
        videos = getHomeResults(0, true, channelResp.body);
        return new SomeChannelVideoPager(videos, hasMore, context);
    };

    const seasonsResp = http.GET(
        `${API_COLLECTIONS}${id}/items`, 
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );
    
    if (!seasonsResp.isOk) 
        throw new ScriptException(`Failed to retrieve channel seasons details [${seasonsResp.code}]`)

    const seasons = JSON.parse(seasonsResp.body).items.reverse() // Seasons, in reverse order from newest to oldest

    for (const season of Object.values(seasons)) {
        const seasonResp = http.GET(
            `${API_COLLECTIONS}${season.entity.id}/items`, 
            { 
                Authorization: `Bearer ${bearer}`,
                Accept: 'application/json',
                Referer: URL_PLATFORM 
            }, 
            true
        );
    
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
        }
    }

    return new SomeChannelVideoPager(videos, hasMore, context);
}

source.isContentDetailsUrl = function(url) {
	return REGEX_DETAILS_URL.test(url);
}

source.getContentDetails = function(url) {
    const video = getVideoDetails(url);

    const sourceDetails = http.GET(
        `https://api.vhx.tv/videos/${video.id}/files`, 
        { 
            Authorization: `Bearer ${video.bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );

    if (!sourceDetails.isOk)
        throw new ScriptException(`Failed to retrieve video details for video ID ${video.id} [${sourceDetails.code}]`);

    const channel = video.metadata.series_id !== undefined && getCollectionDetails(video.metadata.series_id, bearer);
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
        return getCollectionDetails(getSeriesId(url), getBearer()).type == 'playlist';
    };
}

source.getPlaylist = function (url) {
    const id = getSeriesId(url);
    const bearer = getBearer();

    log(API_COLLECTIONS_VIDEOS.replace('ID', id));

    const playlist = getCollectionDetails(id, bearer);
    const playlistVideos = getCollectionVideos(id, bearer);

    const videos = [];

    for (const v of Object.values(playlistVideos.items)) {
        const video = v.entity;
        const channel = video.metadata.series.id !== null && getCollectionDetails(video.metadata.series.id, bearer);

        videos.push(new PlatformVideo({
            id: new PlatformID(PLATFORM, String(video.id), config.id),
            name: video.title,
			thumbnails: new Thumbnails([new Thumbnail(video.thumbnails["16_9"].large, 0)]),
			author: new PlatformAuthorLink(
				new PlatformID(PLATFORM, video.metadata.series.id, config.id),
				video.metadata.series.name || PLATFORM,
				channel.page_url || URL_PLATFORM,
				channel.thumbnails?.["1_1"]?.medium || ICON_TRILOGYPLUS
			),
			datetime: Math.round((new Date(video.created_at)).getTime() / 1000),
			duration: video.duration.seconds,
			viewCount: null,
			url: video.page_url,
			isLive: video.live_video
		}));
    }

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
        contents: new PlaylistContentsPager(videos, playlist.pagination?.page)
    });
}

source.searchPlaylists = function (query, type, order, filters, continuationToken) {
    const playlists = getSearchResults(1, query, 'playlist');

    const hasMore = false; // Are there more pages?
    const context = { query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeSearchPlaylistsPager(playlists, hasMore, context);
}

source.getComments = function (url, continuationToken) {
    const video = getVideoDetails(url);
    
    const commentsResp = http.GET(
        video._links.comments.href, 
        { 
            Authorization: `Bearer ${video.bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );

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

}

source.getSubComments = function (comment) {
    /**
     * @param comment: Comment
     * @returns: SomeCommentPager
     */

	if (typeof comment === 'string') {
		comment = JSON.parse(comment);
	}

	return getCommentsPager(comment.context.claimId, comment.context.claimId, 1, false, comment.context.commentId);
}

function getBearer(html) {
    if (html) {
        return extractDetail(html, REGEX_BEARER_TOKEN)
    } else {
        const siteResp = http.GET(URL_PLATFORM + 'browse', {}, true);
        if (!siteResp.isOk) 
            throw new ScriptException(`Failed to get token, try relogging in [${siteResp.code}]`);
        return extractDetail(siteResp.body, REGEX_BEARER_TOKEN)
    }
}

function getHomeResults(page, excludeCategorized = false, html)  {
    const bearer = getBearer(html)
    const homeResp = http.GET(URL_NEWRELEASES, { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );
    
    if (!homeResp.isOk) {
        const siteResp = http.GET(URL_PLATFORM  + 'browse', {}, true);
        throw new CaptchaRequiredException(URL_PLATFORM + 'browse', siteResp.body);
    };

    const results = JSON.parse(homeResp.body);

    const videos = [];

    for (const v of Object.values(results.items)) {
        const video = v.entity
        const channel = video.metadata.series.id !== null && getCollectionDetails(video.metadata.series.id, bearer); 
        
        if (excludeCategorized && channel) { // Check if to exclude categorized (series) videos
            continue;
        }

        videos.push(new PlatformVideo({
            id: new PlatformID(PLATFORM, String(video.id), config.id),
            name: video.title,
            thumbnails: new Thumbnails([new Thumbnail(video.thumbnails["16_9"].large, 0)]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, String(video.metadata.series.id), config.id),
                video.metadata.series.name || "Trilogy Plus",
                channel?.page_url || URL_PLATFORM,
                channel?.thumbnails?.["16_9"].large || ICON_TRILOGYPLUS
            ),
            datetime: parseInt((new Date(video.created_at)).getTime() / 1000),
            duration: video.duration.seconds,
            viewCount: null,
            url: video.page_url,
            shareUrl: video.page_url,
            isLive: false
        }));
    };

    return videos;
}

function getSearchResults(page, query, returnType, bearer = getBearer()) {
    // Decide which query parameter to use
    const searchType = ((returnType == 'series' || returnType == 'playlist') && 'collection') || returnType
    
    const searchResp = http.GET(
        `${API_BASE}search?q=${query}&type=${searchType}&page=${page}`,
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );
    
    if (!searchResp.isOk) {
        throw new ScriptException(`Search type ${searchType} failed [${searchResp.code}]`);
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
                results.push(new PlatformPlaylist({
                    id: new PlatformID(PLATFORM, entity.id.toString(), plugin.config.id),
                    author: new PlatformAuthorLink(
                        new PlatformID(
                            PLATFORM, 
                            entity.site_id.toString(), 
                            config.id
                        ), 
                        PLATFORM, 
                        URL_PLATFORM, 
                        ICON_TRILOGYPLUS
                    ),
                    name: entity.title,
                    thumbnail: entity.thumbnails?.['16_9']?.large || ICON_TRILOGYPLUS,
                    videoCount: entity.videos_count,
                    url: entity.page_url
                }));
            } else if (returnType == 'video') {
                results.push(new PlatformVideo({
                    id: new PlatformID(PLATFORM, String(entity.id), config.id),
                    name: entity.title,
                    thumbnails: new Thumbnails([new Thumbnail(entity.thumbnails["16_9"].large, 0)]),
                    author: new PlatformAuthorLink(
                        new PlatformID(PLATFORM, seriesId, config.id),
                        entity.metadata?.series?.name || PLATFORM,
                        channel?.page_url || URL_PLATFORM,
                        channel?.thumbnails?.["1_1"].medium || ICON_TRILOGYPLUS
                    ),
                    datetime: Math.round((new Date(entity.created_at)).getTime() / 1000),
                    duration: entity.duration?.seconds,
                    viewCount: null,
                    url: entity.page_url,
                    isLive: entity.live_video
                }));
            };
        };
    };

    return results;
}

// Helper: Generate image for miscellaneous avatars in comments
function generateAvatar(name) {
    log(API_UI_AVATARS + name.replace(/ /g, '+'));
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

function getCollectionDetails(id, bearer) {
    const channelDetailsResp = http.GET(
        API_COLLECTIONS + id,
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );

    if (!channelDetailsResp.isOk) {
        throw new ScriptException(`Failed to retrieve details for collection ID ${id} [${channelDetailsResp.code}]`)
    };

    return JSON.parse(channelDetailsResp.body);
}

function getCollectionVideos(id, bearer) {
    const videosResp = http.GET(
        API_COLLECTIONS_VIDEOS.replace('ID', id), 
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );
    
    if (!videosResp.isOk)  {
        throw new ScriptException(`Failed to retrieve videos for collection ID ${id} [${videosResp.code}]`)
    };

    return JSON.parse(videosResp.body);
}

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
    const seriesResp = http.GET(url, {}, true);

    if (!seriesResp.isOk) {
        throw new ScriptException(`Failed to get id from series ${url} [${seriesResp.code}]`);
    };

    return extractDetail(seriesResp.body, REGEX_CHANNEL_ID);
}


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
    constructor(initialResults, hasMore) {
		super(initialResults, hasMore);
        this.page = 0;
	}
	
	nextPage() {
        this.page++;
        this.results = (this.page);
        this.hasMore = true;
		return this;
	}
}

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