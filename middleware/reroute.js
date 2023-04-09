import _ from 'lodash';
import axios from 'axios';

export default function reroute(middlewareOptions) {
	let middlewareSettings = {
		baseUrl: global.app?.config?.server?.url || 'http://localhost',
		logger: global.app?.log ? global.app.log.as('Reroute') : console.log,
		preserveUser: true,
		terminate: true,
		user: null,
		...middlewareOptions,
	};

	return (req, res, next) => {
		/**
		* Make an internal loopback request via Axios
		* This method wraps various tedious actions like the baseUrl / auth and headers needed to do this
		* @param {AxiosRequest} axiosRequest Base axios request to decorate + reroute and wait for response
		* @param {Object} [options] Options to mutate behaviour
		* @param {Boolean} [options.preserveUser=true] Try to carry over the logged in user if possible
		* @param {Boolean} [options.terminate=true] Terminate the express request when finished, returning the rerouted requests response
		* @param {String|Object} [options.user] The user to immitate, either the full object or the user._id, overrides `preserveUser` if set
		*
		* @returns {*} The data response from the action
		*
		* @example Internal routing request
		* req.reroute({
		*   method: 'POST',
		*   url: '/api/some/endpoint',
		*   data: {...},
		* })
		*/
		req.reroute = function(axiosRequest, options) {
			let settings = {...middlewareSettings, ...options};

			// Try to carry the existing user over if its not already overriden
			if (settings.preserveUser && !settings.user) settings.user = req.user;

			options.logger.as(...[
				'Reroute',
				options.logger.colors.bold.blue(axiosRequest.method || 'GET'),
				options.logger.colors.blue(axiosRequest.url),
				(settings.user && 'as user ' + options.logger.colors.cyan(
					(_.isString(settings.user)) ? settings.user : _.get(settings.user, 'username', settings.user),
				)),
			]);

			return axios(_.merge(
				{},
				{
					baseURL: settings.baseUrl, // Internal request to same instance
					headers: {
						secret: app.config.secretHash, // FIXME: No idea how to carry this over
						...(settings.user && {
							user: (_.isString(settings.user)) ? settings.user : _.get(settings.user, '_id', settings.user),
						}),
					},
				},
				axiosRequest,
			))
				.then(({data}) => settings.terminate
					? res.send(data)
					: data
				)
				.catch(e => {
					if (settings.terminate) return res.sendError(e);
					throw e;
				})
		};

		next();
	};

}
