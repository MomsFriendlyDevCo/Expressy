import axios from 'axios';
import bodyParser from 'body-parser';
import {dirName} from '@momsfriendlydevco/es6';
import Expressy from '#lib/expressy';
import {expect} from 'chai';
import mlog from 'mocha-logger';

const host = 'localhost';
const port = 8000;
const baseUrl = `http://${host}:${port}`;

describe('@MomsFriendlyDevCo/Expressy - hotswap webserver', ()=> {

	let expressy;

	it('setup simple webserver', ()=> {
		expressy = new Expressy()
			.use(bodyParser.json())
	});

	it('setup test data', ()=>
		expressy.gadgets = [
			{ id: 'foo', title: 'Foo!' },
			{ id: 'bar', title: 'Bar!' },
			{ id: 'baz', title: 'Baz!' },
		]
	);

	it('watch dynamic files', ()=>
		expressy.watch(`${dirName()}/hotswapable/*.js`)
	)

	it('boot the server', ()=>
		expressy.boot({
			host,
			port,
		})
	);

	it('ReST: query', ()=>
		axios.get(`${baseUrl}/api/gadgets`)
			.then(({data}) => {
				expect(data).to.be.an('array');
				data.forEach(d => {
					expect(d).to.have.property('id');
					expect(d).to.have.property('title');
				});
			})
	);

	it('ReST: get', ()=> Promise.resolve()
		.then(()=> axios.get(`${baseUrl}/api/gadgets/bar`))
		.then(({data}) => {
			expect(data).to.be.an('object');
			expect(data).to.deep.equal({
				id: 'bar',
				title: 'Bar!',
			});
		})
		.then(()=> expressy.hotswap(`${dirName()}/hotswapable/gadgets.get.js`))
		.then(()=> axios.get(`${baseUrl}/api/gadgets/bar`))
		.then(({data}) => {
			expect(data).to.be.an('object');
			expect(data).to.deep.equal({
				id: 'bar',
				title: 'Bar!',
			});
		})
	);

	it('ReST: post', ()=>
		axios.post(`${baseUrl}/api/gadgets/baz`, {doodads: 100})
			.then(({data}) => {
				expect(data).to.be.an('object');
				expect(data).to.deep.equal({
					id: 'baz',
					title: 'Baz!',
					doodads: 100,
				});
			})
	);

	after('close the server', ()=> expressy.close());

});
