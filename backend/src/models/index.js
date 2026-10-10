// backend/src/models/index.js
'use strict';

const Post = require('./Post');
const Comment = require('./Comment');
const Reaction = require('./Reaction');

module.exports = {
  Post,
  Comment,
  Reaction,
};
