import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crash from '@momsfriendlydevco/crash';
import historyFallback from 'connect-history-api-fallback-exclusions';
import helmet from 'helmet';
import jail from 'express-jail';

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

export function sendError(options) { // eslint-disable-line no-unused-vars
	return (req, res, next) => {
		/**
		* Report an error via Express, optionally showing a trace
		*
		* This is really just a convenience function to set all the weird headers when an error occurs
		*
		* HTTP response codes are determined by the logic:
		*
		*     1. If `code` is provided and is finite
		*     2. If `err` is a string and is prefixed as `xxx:Text` the first part is used as the HTTP response code with the second as the error message
		*     3. Otherwise `400` is assumed and a stack trace shown if passed an error object
		*
		* @param {number} [code=400] Optional error code to use
		* @param {string} err The error to report
		* @return {undefined} This function is fatal to express as it closes the outbound connection when it completes
		*
		* @example Throw error 404
		* res.sendError(404)
		*
		* @example Throw general error with 400 - this will also show a trace
		* res.sendError('This is an error')
		*
		* @example Throw error 512 with custom text within one string - will not show a trace (as the code indicates the function handled the response)
		* res.sendError('512: This is a custom error')
		*/
		res.sendError = function(code, err) {
			// Process optional string prefix (if we're using the default error fallback)
			let resCode, resErr; // Actual response code(number) + error(string)
			let showThrow = true; // Whether to show the full trace on the console, disabled if it looks like the upstream handled the response correctly

			let errBits;
			if (isFinite(code)) { // User provided explicit code argument
				resCode = code;
				resErr = err;
				showThrow = false;
				// eslint-disable-next-line no-cond-assign
			} else if (errBits = /^(?<code>\d+)\s*:\s*(?<err>.*)$/.exec(code)?.groups) { // Can extract code from error string
				resCode = errBits.code;
				resErr = errBits.err;
				showThrow = false;
			} else if (typeof code == 'string') { // Generic string
				err = code;
				resCode = 400;
				resErr = code;
				showThrow = true;
			} else if (code instanceof Error) { // Given raw error object
				err = code;
				resCode = 400;
				resErr = code.toString();
				showThrow = true;
			} else { // No code we can work out nor extract, assume 400
				resCode = 400;
				resErr = 'An error occured';
				err = new Error('An unhandled error occured');
				showThrow = true;
			}

			res.errorBody = resErr; // Populate errorBody so upstream loggers can display a digest
			if (!res.headersSent) {
				res.format({
					json: ()=> res
						.status(resCode)
						.send({err: resErr}),
					default: ()=> res
						.status(resCode)
						.send(resErr),
				})
			} else {
				console.warn('Cannot send error when headers have already been sent');
			}

			if (showThrow) // If given an actual error object AND the user didn't provide a handled HTTP code - show a trace
				crash.trace(err, {prefix: 'Caught server error'});
		}

		return next();
	}
}


export default {
	defaults,
	inject,
}
