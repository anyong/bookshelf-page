# bookshelf-page

[![Version (npm)](https://img.shields.io/npm/v/bookshelf-page.svg)](https://npmjs.com/package/bookshelf-page)

Simple pagination for Bookshelf.js.

Easy to use, works with complex, nested, related queries, and sorts results - all included.

## Installation

First, install `bookshelf-page`.

```
npm install -s bookshelf-page
```

Then, add the plugin to your bookshelf instance:

```
import config from './knexfile';
import knex from 'knex';
import bookshelf from 'bookshelf';
const ORM = bookshelf(knex(config));

// Add this line wherever you create your bookshelf instance
ORM.plugin('bookshelf-page');

export default ORM;
```

## Use

The plugin attaches two instance methods to the bookshelf
Model object: orderBy and fetchPage.

Model#orderBy calls the underlying query builder's orderBy method, and
is useful for ordering the paginated results.

Model#fetchPage works like Model#fetchAll, but returns a single page of
results instead of all results, as well as the pagination information

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

Similar to {@link Model#fetchAll}, but fetches a single page of results
as specified by the limit (page size) and offset or page number.

Any options that may be passed to {@link Model#fetchAll} may also be passed
in the options to this method.

To perform pagination, include a `limit` and _either_ `offset` or `page`.
If an invalid limit, offset, or page parameter is passed
(i.e., limit < 1, offset < 0, page < 1), an error will be thrown.

#### Example

Below is a complete example showing the user of a JOIN query with sort/ordering,
pagination, and related models.

```js
Car
.query(function (qb) {
   qb.innerJoin('manufacturers', 'cars.manufacturer_id', 'manufacturers.id');
   qb.groupBy('cars.id');
   qb.where('manufacturers.country', '=', 'Sweden');
})
.orderBy('-productionYear') // Same as .orderBy('cars.productionYear', 'DESC')
.fetchPage({
   limit: 15, // Defaults to 10 if not specified
   page: 3, // Defaults to 1 if not specified; same as {offset: 30} with limit of 15.
})
.then(function (results) {
   console.log(results); // Paginated results object with metadata example below
})
```

The `results` object contains the requested rows and pagination metadata.
For the previous example, the `results` object looks like this:

```js
{
   rows: [<Car>], // the requested page of results
   rowCount: 15, // Would be less than 15 on the last page of results
   total: 53, // Total number of rows found for the query before pagination
   limit: 15, // The requested number of rows per page, same as rowCount except final page
   page: 3, // The requested page number
   offset: 30 // The requested offset, calculated from the page/limit if not provided
}
```

#### Parameters

- options {object} The pagination options, plus any additional options that will be passed to
  Model#fetchAll