#!/usr/bin/env node

import { proxy } from '.';

const [, , from, to] = [...process.argv, 'http://localhost:3000', 'proxy'];

proxy(from, to);
