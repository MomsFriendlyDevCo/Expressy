export default function(app) {
	app.post('/api/gadgets/:id', (req, res) => {
		return res.send({
			...app.gadgets.find(w => w.id == req.params.id),
			...req.body,
		});
	});
}
