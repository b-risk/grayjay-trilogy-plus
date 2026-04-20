// Platform information
const PLATFORM = 'Trilogy Plus'
const URL_PLATFORM = 'https://www.trilogyplus.com/';

// Image used for channels (specific series images not yet supported)
const ICON_TRILOGYPLUS = "https://dr56wvhu2c8zo.cloudfront.net/trilogyplus/assets/739ad5e0-ee07-4677-ac2b-c0c5ab40adb3.png";

const API_BASE = 'https://api.vhx.com/v2/sites/156301/'
const API_COLLECTIONS = API_BASE + 'collections/'

// URLs handling different pages for content
const URL_NEWRELEASES = API_COLLECTIONS + '1491720/items?include_products_for=web&per_page=12&include_events=1&include_coming_soon=1';
const URL_FULLSHOWS = API_COLLECTIONS + '1080914/items'
const URL_CHANNELVIDEOS = API_COLLECTIONS + '1021973/item'

// Regex metadata
const REGEX_DETAILS_URL = /^https:\/\/www\.trilogyplus\.com\/videos\/[^\/]+$/;
const REGEX_CHANNEL_URL = /^https:\/\/www\.trilogyplus\.com\/[^\/]+$/;
const REGEX_CHANNEL_ID = /"COLLECTION_ID":"?([^",]+)"?,"COLLECTION_TITLE"/;
const REGEX_VIDEO_URL = /embed_url:\s*"([^"]*)"/;
const REGEX_VIDEO_ID = /"video","VIDEO_ID":(\d+)/;
const REGEX_VIDEO_COMMENTS_ID = /window\.COMMENTABLE_ID\s*=\s*(\w+)/i;
const REGEX_VIDEO_TITLE = /<meta\s+property="og:title"\s+content="([^"]*)"/i; // Unused

const REGEX_BEARER_TOKEN = /window\.TOKEN\s*=\s*"([^"]+)";/m;

const supportedResolutions = {
	'1080p': { width: 1920, height: 1080 },
	'720p': { width: 1280, height: 720 },
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
    return new HomePager(getHomeResults(0, false), true);
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
    /**
     * @param query: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */
    const searchResp = http.GET(`${API_BASE}search?q=${query}&type=video%2Ccollection%2Clive_event%2Cproduct&page=1`, {}, true)
    
    const videos = []; // The results (PlatformVideo)
    
    if (!searchResp.isOk)
        throw new ScriptException(`Failed to get videos, try relogging in [${searchResp.code}]`)

    if (Object.keys(JSON.parse(searchResp.body).results).length > 0) {
        for (const v of Object.values(JSON.parse(searchResp.body).results)) {
            const video = v.entity;
            const seriesId = video.metadata?.series?.id;
            const channel = seriesId ? getChannelDetails(seriesId) : null; 
            videos.push(new PlatformVideo({
                id: new PlatformID(PLATFORM, String(video.id), config.id),
                name: video.title,
				thumbnails: new Thumbnails([new Thumbnail(video.thumbnails["16_9"].large, 0)]),
				author: new PlatformAuthorLink(
					new PlatformID(PLATFORM, seriesId, config.id),
					video.metadata?.series?.name || PLATFORM,
					channel?.page_url || URL_PLATFORM,
					channel?.thumbnails?.["1_1"].medium || ICON_TRILOGYPLUS
				),
				datetime: Math.round((new Date(video.created_at)).getTime() / 1000),
				duration: video.duration?.seconds,
				viewCount: null,
				url: video.page_url,
				isLive: video.live_video
		    }))
        }
    }

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
    const showsResp = http.GET(URL_FULLSHOWS, {}, true);
    
    if (!showsResp.isOk) 
        throw new ScriptException(`Failed to get channels, try relogging in [${showsResp.code}]`)

    const results = JSON.parse(showsResp.body);

    const channels = []; // The results (PlatformChannel)

    channels.push(new PlatformChannel({ // Add uncategorized channel "Trilogy Plus"
            id: new PlatformID(PLATFORM, null, config.id),
            name: PLATFORM,
            thumbnail: ICON_TRILOGYPLUS,
            banner: ICON_TRILOGYPLUS,
            subscribers: null,
            description: "Trilogy Plus is an immersive streaming service with the best entertainment in scambaiting, scam-busting, travel and true crime.",
            url: URL_PLATFORM,
            links: {}
        }));
    
    for (const channel of Object.values(results.items)) {
        channels.push(new PlatformChannel({
            id: new PlatformID(PLATFORM, channel.entity.id.toString(), config.id),
            name: channel.entity.title,
            thumbnail: channel.entity.thumbnails["1_1"].medium,
            banner: channel.entity.thumbnails["16_6"]?.source,
            subscribers: null,
            description: channel.entity.description,
            url: channel.entity.page_url,
            links: {}
        }));
    }

    const hasMore = false;
    const context = { query: query, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeChannelPager(channels, hasMore, context);
}

source.isChannelUrl = function(url) {
    if (url == URL_PLATFORM) {
        return true;
    }

	return REGEX_CHANNEL_URL.test(url);
}

source.getChannel = function(url) {
    const showResp = http.GET(url, {}, true);
    
    if (!showResp.isOk) 
        throw new ScriptException(`Failed to get channel, try relogging in [${showResp.code}]`)

    let channel = null;
    
    if (url !== URL_PLATFORM) {
        const id = extractDetail(showResp.body, REGEX_CHANNEL_ID);
        channel = getChannelDetails(id);
    }

	return new PlatformChannel({
        id: new PlatformID(PLATFORM, String(channel?.id), config.id),
        name: channel?.title || PLATFORM,
        thumbnail: channel?.thumbnails["1_1"]?.medium || ICON_TRILOGYPLUS,
        banner: channel?.thumbnails["16_6"]?.source || ICON_TRILOGYPLUS,
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

    const channel = id && getChannelDetails(id);  

    let videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { url: url, query: null, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page

    if (url == URL_PLATFORM ) { // Check if channel is uncategorized (not part of any series,) then return the uncategorized videos
        videos = getHomeResults(0, true);
        log(JSON.stringify(videos));
        return new SomeChannelVideoPager(videos, hasMore, context);
    };

    const seasonsResp = http.GET(`${API_COLLECTIONS}${id}/items`, {}, true);
    
    if (!seasonsResp.isOk) 
        throw new ScriptException(`Failed to retrieve channel seasons details [${seasonsResp.code}]`)

    const seasons = JSON.parse(seasonsResp.body).items.reverse() // Seasons, in reverse order from newest to oldest

    for (const season of Object.values(seasons)) {
        const seasonResp = http.GET(`${API_COLLECTIONS}${season.entity.id}/items`, {}, true);
    
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
    const videoResp = http.GET(url, {}, true);
    
    if (!videoResp.isOk) 
        throw new ScriptException(`Failed to retrieve video details [${videoResp.code}]`)
    
    const id = extractDetail(videoResp.body, REGEX_VIDEO_ID);
    const bearer = extractDetail(videoResp.body, REGEX_BEARER_TOKEN);
    
    if (!id || !bearer) 
        throw new ScriptException(`Failed to fetch video details, Trilogy Plus likely changed their site.`)
    
    const video = getVideoDetails(id, bearer);

    const channel = video.metadata.series_id !== undefined && getChannelDetails(video.metadata.series_id);   

    const sourceDetails = http.GET(
        `https://api.vhx.tv/videos/${id}/files`, 
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );

    if (!sourceDetails.isOk)
        throw new ScriptException(`Failed to retrieve video details [${sourceDetails.code}]`);

    let sources = [];

    // Loop through video sources
    for (const source of Object.values(JSON.parse(sourceDetails.body))) {
        if (source.method == "hls") {
            sources.push(new HLSSource({
                name: source.codec,
                url: source._links.source.href,
                priority: true
            }));
        } 
    }
    
    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, String(id), config.id),
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


source.getComments = function (url, continuationToken) {
    // const videoResp = http.GET(url, {}, true);
    
    // if (!videoResp.isOk) 
    //     throw new ScriptException(`Failed to retrieve video details [${videoResp.code}]`)

    // const id = extractDetail(videoResp.body, REGEX_VIDEO_COMMENTS_ID)

    // const commentsResp = http.GET(`${URL_PLATFORM}comments?commentable_type=Video&commentable_id=${id}&sort=desc&sort_by=created_at`, 
    //     {
    //         Accept: 'application/json',
    //         Referer: URL_PLATFORM 
    //     },
    //     true
    // )
    
    // if (!commentsResp.isOk) 
    //     throw new ScriptException(`Failed to retrieve comments [${commentsResp.code}]`)

    // const results = domParser.parseFromString(
    //     JSON.parse(commentsResp.body).partial,
    //     'text/html'
    // );   

    // throw new ScriptException(results) // Returns null
    const comments = []; // The results (Comment)
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

function getHomeResults(page, excludeCategorized) {
    const homeResp = http.GET(URL_NEWRELEASES, {}, true);
    
    if (!homeResp.isOk) 
        throw new ScriptException(`Failed to get videos in feed, try relogging in [${homeResp.code}]`)

    const results = JSON.parse(homeResp.body);

    const videos = []

    for (const v of Object.values(results.items)) {
        const video = v.entity

        const channel = video.metadata.series.id !== null && getChannelDetails(video.metadata.series.id); 
        
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

function getVideoDetails(id, bearer) {
    const videoResp = http.GET(
        `https://api.vhx.tv/videos/${id}`, 
        { 
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            Referer: URL_PLATFORM 
        }, 
        true
    );

    if (!videoResp.isOk)
        throw new ScriptException(`Failed to retrieve video details [${videoResp.code}]`);

    return JSON.parse(videoResp.body)
}

function getChannelDetails(id) {
    const channelDetailsResp = http.GET(API_COLLECTIONS + id, {}, true);

    if (!channelDetailsResp.isOk) 
        throw new ScriptException(`Failed to retrieve details for channel (${API_COLLECTIONS + id}) [${channelDetailsResp.code}]`)

    return JSON.parse(channelDetailsResp.body)
}

// Extract detail using regex
function extractDetail(html, regex) {
    const match = html.match(regex);

    if (match) {
        return match[1];
    } else {
        return null;
    }
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
        this.results = getHomeResults(this.page, false);
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

class SomeSearchChannelVideoPager extends VideoPager {
	constructor(results, hasMore, context) {
		super(results, hasMore, context);
	}
	
	nextPage() {
		return source.searchChannelContents(this.context.channelUrl, this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
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