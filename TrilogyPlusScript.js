const PLATFORM = "Trilogy Plus"

const URL_PLATFORM = "https://trilogyplus.com";
const URL_HOMEPAGE = "https://api.vhx.com/v2/sites/156301/users/77781645/watching?per_page=12&include_events=1&include_collections=1"
const API_HOMEPAGE_URL = "https://api.vhx.com/v2/sites/156301/collections/1130073/items";

const REGEX_EMBED_URL = /embed_url:\s*"?(https:\/\/embed\.vhx\.tv\/videos\/\d+)"?/;

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
    /**
     * @param query: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */
    const videos = []; // The results (PlatformVideo)
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

source.searchChannels = function (query, continuationToken) {
    /**
     * @param query: string
     * @param continuationToken: any?
     * @returns: ChannelPager
     */

    const channels = []; // The results (PlatformChannel)
    const hasMore = false; // Are there more pages?
    const context = { query: query, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeChannelPager(channels, hasMore, context);
}

source.isChannelUrl = function(url) {
    /**
     * @param url: string
     * @returns: boolean
     */

	return REGEX_CHANNEL_URL.test(url);
}

source.getChannel = function(url) {
	return new PlatformChannel({
		//... see source.js for more details
	});
}

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    /**
     * @param url: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */

    const videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { url: url, query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new SomeChannelVideoPager(videos, hasMore, context);
}

source.isContentDetailsUrl = function(url) {
    /**
     * @param url: string
     * @returns: boolean
     */

	return REGEX_DETAILS_URL.test(url);
}

source.getContentDetails = function(url) {
    const html = http.POST(
        API_HOMEPAGE_URL,
        `include_products_for=web&per_page=12&include_events=1`,
        {},
        true
    )

    throw new ScriptException(bridge.isLoggedIn() + "\n" + html.body);
    
    const videoURL = extractVideoLink(html);
    
	return new PlatformVideoDetails({});

}

source.getComments = function (url, continuationToken) {
    /**
     * @param url: string
     * @param continuationToken: any?
     * @returns: CommentPager
     */

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

function getHomeResults(page) {
    const homeResp = http.GET(URL_HOMEPAGE, {}, true);
    
    if (!homeResp.isOk) 
        throw new ScriptException(`Failed to get home [${homeResp.code}]`)

    const results = JSON.parse(homeResp.body);

    return results.items.map(item => new PlatformVideo({
        id: new PlatformID(PLATFORM, String(item.entity.id), config.id),
        name: item.entity.title,
        thumbnails: new Thumbnails([new Thumbnail(item.entity.thumbnails["16_9"].large, 0)]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, String(item.entity.id), config.id),
            item.entity.metadata.series.name,
            null,
            null
        ),
        datetime: parseInt((new Date(item.entity.created_at)).getTime() / 1000),
        duration: item.entity.duration.seconds, // Access seconds here
        viewCount: null, // Assuming you want to set it to null
        url: item.entity.page_url,
        shareUrl: item.entity.page_url,
        isLive: false
    }));
}

// Helper: Make HTTP GET request
function makeGetRequest(url) {
    try {
        const resp = http.GET(
            "https://trilogyplus.com/login/", 
            { 'User-Agent': config.authentication.userAgent },
            true
        );

        if (!resp.isOk) {
            log(`Request failed with status ${resp.code}: ${url}`);
            if (returnError) {
                return { error: true, code: resp.code, body: resp.body };
            }
            return null;
        }
        return resp.body;
    } catch (e) {
        throw new ScriptException(`Request error: ${e.message}`);
    }
}

// Helper: Extract video link from HTML string
function extractVideoLink(html) {
    const match = html.match(REGEX_EMBED_URL);

    if (match) {
        return match[1]; // Return the video link captured in the first group
    } else {
        return null; // Return null if no match is found
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