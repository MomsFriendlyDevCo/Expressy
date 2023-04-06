import axios from 'axios';
import bodyParser from 'body-parser';
import {dirName} from '@momsfriendlydevco/es6';
import Expressy from '#lib/expressy';
import {expect} from 'chai';

const host = 'localhost';
const port = 8000;
const baseUrl = `http://${host}:${port}`;

/*global app*/

describe('@MomsFriendlyDevCo/Expressy - Doop webserver', ()=> {

	it('setup base `global.app` object', ()=>
		import('@doop/esm-loader/app')
	)

	it('extend app with Expressy', ()=> {
		// Create local (private) Expressy instance
		let expressy = new Expressy();

		app
			.extend({
				// Copy all Express methods into app (e.g. 'app.get() -> expressy.get()')
				...Object.fromEntries(
					expressy.methods
						.map(k => [
							k,
							(...args) => {
								expressy[k](...args);
								return app;
							},
						]),
				),

				// Create app.watch() as an emitter pattern to queue up file scan on init
				watch: (...args) => {
					app.on('init', ()=> expressy.watch(...args));
					return app;
				},
			})
			.on('close', ()=> expressy.close()) // Add closing the server into the 'close' emitter
			.on('server', ()=> expressy.boot({ // Attach actual Expressy server boot code
				host,
				port,
			}))
	});

	it('setup test data', ()=> {
		let data = [// Storage for what modules loaded and in what order
			{ id: 'foo', title: 'Foo!' },
			{ id: 'bar', title: 'Bar!' },
			{ id: 'baz', title: 'Baz!' },
		];

		app.extend({
			loaded: [],
			doodads: data,
			gizmos: data,
		});
	});

	it('setup Doop webserver', function() {
		this.timeout(10 * 1000); //~ 10s

		return app
			.use(bodyParser.json())
			.watch(`${dirName()}/doop/*.doop`) // Add all files
			.emitSequence() // Kick off the usual load sequence order
	});

	it('load paths in correct order', ()=> {
		// console.warn('LOAD ORDER', app.loaded);
		expect(app.loaded[0]).to.equal('USE middleware:logging'); // Middleware should load first

		// Expect rest of payload to be regular routing
		app.loaded.slice(1, -1).forEach(l => {
			expect(l).to.match(/^(DELETE|GET|POST) .+$/);
		});

		expect(app.loaded.at(-1)).to.equal('USE preReady:errorHandling'); // Final endpoint should handle error handling
	});

	it('ReST: query', ()=>
		axios.get(`${baseUrl}/api/doodads`)
			.then(({data}) => {
				expect(data).to.be.an('array');
				data.forEach(d => {
					expect(d).to.have.property('id');
					expect(d).to.have.property('title');
				});
			})
	);

	it('ReST: get', ()=> Promise.resolve()
		.then(()=> axios.get(`${baseUrl}/api/doodads/bar`))
		.then(({data}) => {
			expect(data).to.be.an('object');
			expect(data).to.deep.equal({
				id: 'bar',
				title: 'Bar!',
			});
		})
	);

	it('ReST: post', ()=>
		axios.post(`${baseUrl}/api/doodads/baz`, {doodads: 100})
			.then(({data}) => {
				expect(data).to.be.an('object');
				expect(data).to.deep.equal({
					id: 'baz',
					title: 'Baz!',
					doodads: 100,
				});
			})
	);

	after('close the server', ()=> app.emit('close'));

});
