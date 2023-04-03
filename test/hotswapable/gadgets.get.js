export default function(app) {
	app.get('/api/gadgets/:id', (req, res) => {
		res.send(app.gadgets.find(w =>
			w.id == req.params.id
		));
	});
}
