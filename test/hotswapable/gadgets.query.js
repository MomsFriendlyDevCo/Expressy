export default function(app) {
	app.get('/api/gadgets', (req, res) => {
		res.send(app.gadgets);
	});
}
