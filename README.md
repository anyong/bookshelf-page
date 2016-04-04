# bookshelf-page v0.3.0

### Important

Please note that this plugin will (hopefully) soon move into bookshelf proper, but there are still a few minor
issues left to work out. Please track the progress of this plugin at:

https://github.com/tgriesser/bookshelf/issues/435 (discussion)

https://github.com/tgriesser/bookshelf/pull/1183 (pull request)

From v0.3.0, the API should not differ between this package and the final plugin once it moves into bookshelf
proper. If you want to use this plugin now, just install it and then see the section on Upgrading below.

[![Version (npm)](https://img.shields.io/npm/v/bookshelf-page.svg)](https://npmjs.com/package/bookshelf-page)

Simple pagination for Bookshelf.js.

Easy to use, works with complex, nested, related queries, and sorts results - all included.

## Installation

First, install `bookshelf-page`.

```
npm install -s bookshelf-page
```

Then, add the plugin to your bookshelf instance:

```js
import config from './knexfile';
import knex from 'knex';
import bookshelf from 'bookshelf';
const ORM = bookshelf(knex(config));

// Add this line wherever you create your bookshelf instance
ORM.plugin('bookshelf-page');

export default ORM;
```

### Upgrading

Once this plugin is accepted into `bookshelf`, you just need to change the line above to:

```js
ORM.plugin('pagination')
```

and then you can remove `bookshelf-page` from your project.

## Use

The plugin attaches two instance methods to the bookshelf
Model object: `orderBy` and `fetchPage`.

Model#orderBy calls the underlying query builder's orderBy method, and
is useful for ordering the paginated results.

Model#fetchPage works like Model#fetchAll, but returns a single page of
results instead of all results, as well as the pagination metadata.

### Model#orderBy

Specifies the column to sort on and sort order.

The order parameter is optional, and defaults to 'ASC'. You may
also specify 'DESC' order by prepending a hyphen to the sort column
name. `orderBy("date", 'DESC')` is the same as `orderBy("-date")`.

Unless specified using dot notation (i.e., "table.column"), the default
table will be the table name of the model `orderBy` was called on.

#### Example

```js
    Car
    .forge()
    .orderBy('color', 'ASC').fetchAll()
    .then(function (rows) { // ...
```

#### Parameters

- sort {string} Column to sort on. Required.
- order {string} Ascending ('ASC') or descending ('DESC') order. Optional.

### Model#fetchPage

Any options that may be passed to `Model#fetchAll` (such as `withRelated`) may also be passed in the options to `fetchPage`, as you can see in the example below.

To perform pagination, you must pass an `options` object with either `page/pageSize` or `limit/offset` keys. The following two calls are equivalent:

```js
fetchPage({page: 10, pageSize: 20});
// OR
fetchPage({limit: 20, offset: 180});
```

By default, with no parameters or missing parameters, `fetchPage` will use an
options object of `{page: 1, pageSize: 10}`

In the resulting pagination metadata, you will receive back the parameters used for pagination, i.e., either `page/pageSize` **or** `offset/limit`, respectively.

Below is an example showing the user of a JOIN query with sort/ordering,
pagination, and related models.

#### Example

##### Calling `fetchPage`

```js
Car
.query(function (qb) {
 qb.innerJoin('manufacturers', 'cars.manufacturer_id', 'manufacturers.id');
 qb.groupBy('cars.id');
 qb.where('manufacturers.country', '=', 'Sweden');
})
.orderBy('-productionYear') // Same as .orderBy('cars.productionYear', 'DESC')
.fetchPage({
 pageSize: 15, // Defaults to 10 if not specified
 page: 3, // Defaults to 1 if not specified

 // OR
 // limit: 15,
 // offset: 30,

 withRelated: ['engine'] // Passed to Model#fetchAll
})
.then(function (results) {
 console.log(results); // Paginated results object with metadata example below
})
```

##### Reading the `pagination` metadata

The `fetchPage` method attaches a `pagination` property to the resolved `Collection` instance.

```js
{
 models: [<Car>], // Regular bookshelf Collection
 // other standard Collection attributes
 ...
 pagination: {
     rowCount: 53, // Total number of rows found for the query before pagination
     pageCount: 4, // Total number of pages of results
     page: 3, // The requested page number
     pageSize: 15, // The requested number of rows per page

     // OR, if limit/offset pagination is used instead of page/pageSize:
     // offset: 30, // The requested offset
     // limit: 15 // The requested limit
 }
}
```
