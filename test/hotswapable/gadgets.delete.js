export default function(app) {
	app.delete('/api/gadgets/:id', (req, res) => res.send(
		app.gadgets = app.gadgets.filter(w => w.id != req.params.id)
	));
}
