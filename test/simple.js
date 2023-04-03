import axios from 'axios';
import bodyParser from 'body-parser';
import Expressy from '#lib/expressy';
import {expect} from 'chai';
import mlog from 'mocha-logger';

const host = 'localhost';
const port = 8000;
const baseUrl = `http://${host}:${port}`;

describe('@MomsFriendlyDevCo/Expressy - simple webserver', ()=> {

	let expressy;
	let widgets = [
		{ id: 'foo', title: 'Foo!' },
		{ id: 'bar', title: 'Bar!' },
		{ id: 'baz', title: 'Baz!' },
	];

	it('setup simple webserver', ()=> {
		expressy = new Expressy();
	});

	it('set up various routes', ()=> {
		expressy
			.use(bodyParser.json())
			.use((req, res, next) => {
				mlog.log('HIT', req.method, req.path)
				next();
			})
			.get('/api/widgets', (req, res) => res.send(widgets))
			.get('/api/widgets/:id', (req, res) => res.send(widgets.find(w => w.id == req.params.id)))
			.post('/api/widgets/:id', (req, res) => {
				return res.send({
					...widgets.find(w => w.id == req.params.id),
					...req.body,
				});
			})
			.delete('/api/widgets/:id', (req, res) => res.send(
				widgets = widgets.filter(w => w.id != req.params.id)
			))
	});

	it('boot the server', ()=>
		expressy.boot({
			host,
			port,
		})
	);

	it('ReST: query', ()=>
		axios.get(`${baseUrl}/api/widgets`)
			.then(({data}) => {
				expect(data).to.be.an('array');
				data.forEach(d => {
					expect(d).to.have.property('id');
					expect(d).to.have.property('title');
				});
			})
	);

	it('ReST: get', ()=>
		axios.get(`${baseUrl}/api/widgets/bar`)
			.then(({data}) => {
				expect(data).to.be.an('object');
				expect(data).to.deep.equal({
					id: 'bar',
					title: 'Bar!',
				});
			})
	);

	it('ReST: post', ()=>
		axios.post(`${baseUrl}/api/widgets/baz`, {doodads: 100})
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
