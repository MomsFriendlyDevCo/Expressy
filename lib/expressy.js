import _ from 'lodash';
import chokidar from 'chokidar';
import Debug from 'debug';
import Express from 'express';

const debug = Debug('expressy');

export default class Expressy {

	/**
	* Eventual Express instance we are proxying
	* This is setup during `build()`
	* @type {Express}
	*/
	express;


	/**
	* HTTP server instance when express has triggered
	* @type {HttpServer}
	*/
	server = null;


	/**
	* Instanciated Chokidar watcher
	* @type {Chokidar}
	*/
	watcher = null;


	/**
	* Queued routes
	* @type {Array<Object>} Collection of routes to use
	* @property {String} method The method to trap or 'all'
	* @property {String|RegExp|Array<String>|Array<RegExp>} path The express compatible path
	* @property {Array<Function>} handlers The express handlers for the route
	*/
	routes = [];


	/**
	* Trappable router methods
	* This omits the meta 'all' type
	* @type {Array<String>}
	*/
	methods = ['all', 'delete', 'get', 'head', 'options', 'patch', 'post', 'set', 'use'];


	/**
	* Worker to actually queue up a route
	* @param {String} method The method to trap or 'all' to capture all methods
	* @param {String|RegExp|Array<String>|Array<RegExp>} path The express compatible path
	* @param {Array<Function>} handlers The express handlers for the route
	* @returns {Expressy} This chainable instance
	*/
	addRoute(method, path, ...handlers) {
		this.routes.push({
			method,
			path,
			handlers,
		});

		return this;
	}


	/**
	* Build all routes and return an Express server
	* @returns {Promise<Expressy>} This chainable eventual instance when building has completed
	*/
	build() {
		debug('Full build');

		_(this.routes)
			.sortBy(route => {
				var sortPath = // Decide primary path element to sort by
					_.isString(route.path) ? route.path // Strings: Use simple string if there is only one route
					: _.isArray(route.path) ? _.first(route.path) // Arrays: Use first element if its an array
					: _.isRegExp(route.path) ? route.path.toString().replace(/\/\//g, '/') // RegExp: try to tidy up path components at least
					: null; // Use null - should sort to high priority

				return _.isString(sortPath) // Translate "/" + ":" into low ranking sort characters
					? sortPath
						.replace(/\//g, String.fromCharCode(824))
						.replace(/:/g, String.fromCharCode(818))
						.replace(/\?/g, String.fromCharCode(825))
					: '';
			})
			.forEach(route => {
				if (debug.enabled) debug(
					'ROUTE',
					route.method.toUpperCase(),
					...(typeof route.path == 'string' ? [route.path] : [])
				);

				this.express[route.method](
					route.path,
					...route.handlers,
				);
			});

		// FIXME: Assumes all routes are sync
		return Promise.resolve(this);
	}


	/**
	* Boot the server for the first time
	* @param {Object} options Options to mutate behaviour
	* @param {String} [options.host='localhost'] Host to listen on
	* @param {Number} [options.port=8080] The port to listen on
	* @returns {Expressy} This eventual instance when the server is now setup
	*/
	boot(options) {
		let settings = {
			host: 'localhost',
			port: 8080,
			...options,
		};

		debug('Boot');
		return Promise.resolve()
			.then(()=> this.express = Express())
			.then(()=> this.build())
			.then(()=> new Promise(resolve =>
				this.server = this.express.listen(settings.port, settings.host, resolve)
			))
			.then(()=> this)
	}


	/**
	* Close the server and clean up
	* @returns {Promise} A promise which resolves when the operation has completed
	*/
	close() {
		return new Promise(resolve => {
			if (this.server) {
				debug('Closing server');
				this.server.close(()=> resolve());
			} else {
				resolve();
			}
		});
	}


	hotswap(path) {
		debug('Hotswap', path);
	}


	/**
	* @param {Object} options Options to mutate behaviour
	* @param {String|Array<String>} paths Paths to watch
	* @returns {Expressy} This chainable instance
	*/
	watch(options) {
		let settings = {
			paths: null,
			hotswap: true,
			...options,
		};
		if (!settings.paths) throw new Error('Must specify at least one `paths` path/glob entry to watch');

		this.watcher = chokidar.watch(settings.paths, {
			awaitWriteFinish: true,
		})
			.on('add', this.rebuild)
			.on('unlink', this.rebuild)

		if (settings.hotswap)
			this.watcher.on('change', path => {
				console.warn('HOTSWAP CHANGE', path);
				this.hotswap(path);
			})

		return this;
	}


	constructor() {
		// Set up all methods as functions (e.g. `expressy.get()` -> `addMethod('get', ...)`)
		this.methods.forEach(method =>
			this[method] = (path, ...handlers) => this.addRoute(method, path, ...handlers)
		);

		// Setup meta 'use'
		this.use = (path, ...handlers) => this.addRoute('use', path, ...handlers);
	}
}
