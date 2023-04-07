@MomsFriendlyDevCo/Expressy
===========================
[ExpressJS](https://expressjs.com) with some extra functionality:

* File watch support
* Hot-swap routing - can rebuild routes on the fly for single file changes without rebooting the whole stack
* [Doop-ESM loader](https://github.com/MomsFriendlyDevCo/Expressy#readme) support
* Out-of-the-box base middleware


To use the Expressy module with the Doop-ESM loader see the instructions in [@Doop/ESM-Loader](https://github.com/MomsFriendlyDevCo/Expressy#readme).


Example - Simple web server
---------------------------
```javascript
import Expressy from '@momsfriendlydevco/expressy';

new Expressy()
	.use(bodyParser.json())
	.use((req, res, next) => {
	  // Example middleware injection
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
```


Base middleware
---------------
This module automatically loads various Express middleware when booting a server.

Configure `expressy.commonMiddleware` ([defaults in commonMiddleware.js](lib/commonMiddleware.js)) to change whether certain items are loaded and with what options.
