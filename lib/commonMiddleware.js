import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import historyFallback from 'connect-history-api-fallback-exclusions';
import helmet from 'helmet';
import jail from 'express-jail';
import sendError from '#middleware/sendError';

export let defaults = {
	bodyParserJson: {
		enabled: true,
		options: {},
	},
	bodyParserUrlEncoded: {
		enabled: true,
		options: {
			limit: '16mb',
			extended: false,
		},
	},
	cors: {
		enabled: true,
		options: {},
	},
	cookieParser: {
		enabled: true,
		options: {},
	},
	helmet: {
		enabled: true,
		options: {
			contentSecurityPolicy: false, // Handled elsewhere
			crossOriginEmbedderPolicy: false, // Was blocking Google Maps address search "NotSameOriginAfterDefaultedToSameOriginByCoep"
			referrerPolicy: false, // We actually DO want links from the source to show up downstream
			frameguard: false, // Allow iframe embeds
			...(!global.app?.config?.isProduction && {hsts: false}), // Disable HTTPS preference for local dev
		},
	},
	historyFallback: {
		enabled: false,
		options: {
			index: '/',
			/*
			exclusions: app.config.layout.excludeBase.concat(paths).map(b =>
				_.isString(b) && b.endsWith('*') ? new RegExp('^' + RegExp.escape(b.replace(/\*$/, '')), 'i')
				: _.isString(b) ? new RegExp('^' + RegExp.escape(b.replace(/\*$/, '')) + '$', 'i')
				: _.isRegExp(b) ? b
				: (()=> { throw new Error(`Unknown app.config.layout.excludeBase rule: "${b}"`) })()
			),
			*/
			logger: global.app?.log ? global.app.log.as('HistoryFallback') : console.warn,
		},
	},
	jail: {
		enabled: false,
		logger: global.app?.log ? global.app.log.as('Jail') : console.warn,
		options: {
		},
	},
	sendError: {
		enabled: true,
	},
};

export function inject(router, options) {

	// helmet {{{
	if (options.helmet.enabled) {
		router.use(helmet(options.helmet.options));
	}
	// }}}

	// jail {{{
	if (options.jail.enabled) {
		router.use(jail(options.jail.options)
			.on('banned', ({ip}) => options.jail.logger('Banned', ip))
		);
	}
	// }}}

	// historyFallback {{{
	if (options.historyFallback.enabled) {
		router.use(historyFallback(options.historyFallback.options))
	}
	// }}}

	// cors {{{
	if (options.cors.enabled) {
		router.use(cors(options.cors.options))
	}
	// }}}

	// cookieParser {{{
	if (options.cookieParser.enabled) {
		router.use(cookieParser(options.cookieParser.options))
	}
	// }}}

	// bodyParser (JSON) {{{
	if (options.bodyParserJson.enabled) {
		router.use(bodyParser.json(options.bodyParserJson.options));
	}
	// }}}

	// bodyParser (URL-Encoded) {{{
	if (options.bodyParserUrlEncoded.enabled) {
		router.use(bodyParser.urlencoded(options.bodyParserUrlEncoded.options));
	}
	// }}}

	// sendError {{{
	if (options.sendError.enabled) {
		router.use(sendError(options.sendError.options));
	}
	// }}}

}

export default {
	defaults,
	inject,
}
