# nodesite.eu

#### Host a website, bypass your ISP's firewall, with little bandwidth, easily!

`yarn add nodesite.eu`

#### Create a dynamic web page with file-based handles!

`npx nodesite.eu dyn your_name_here`

#### Use it programatically!

```javascript
const { create, rewrite } = require('nodesite.eu`);
create('foobar', '/', (request) => rewrite('404.html'), 'public/');
```

#### Play around!

```javascript
const { create } = require('nodesite.eu');

create('fun', '/',      () => ({ statusCode: 302, head: { Location: '/three' } }));
create('fun', '/three', () => ({ statusCode: 302, head: { Location: '/two' } }));
create('fun', '/two',   () => ({ statusCode: 302, head: { Location: '/one' } }));
create('fun', '/one',   () => ({ statusCode: 302, head: { Location: 'https://therickroll.com' } }));
```

#### Check out everyone else's work!

[List of NodeSites](<https://index.nodesite.eu>)

### And remember to have fun! <3

(c) 2021 - Licensed under the [GNU GPL](<https://gnu.org/licenses/gpl>), sources are on [GitHub](<https://github.com/prokopschield/nodesite.eu/>)

Don't be evil.

