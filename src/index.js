import Promise from 'bluebird';
import { remove as _remove } from 'lodash';

/**
 * Exports a plugin to pass into the bookshelf instance, i.e.:
 *
 *      import config from './knexfile';
 *      import knex from 'knex';
 *      import bookshelf from 'bookshelf';
 *
 *      const ORM = bookshelf(knex(config));
 *
 *      ORM.plugin('bookshelf-pagination-plugin');
 *
 *      export default ORM;
 *
 * The plugin attaches two instance methods to the bookshelf
 * Model object: orderBy and fetchPage.
 *
 * Model#orderBy calls the underlying query builder's orderBy method, and
 * is useful for ordering the paginated results.
 *
 * Model#fetchPage works like Model#fetchAll, but returns a single page of
 * results instead of all results, as well as the pagination information
 *
 * See methods below for details.
 */
export default function paginationPlugin (bookshelf) {

    bookshelf.Model = bookshelf.Model.extend({

        /**
         * @method Model#orderBy
         * @since 0.9.3
         * @description
         *
         * Specifies the column to sort on and sort order.
         *
         * The order parameter is optional, and defaults to 'ASC'. You may
         * also specify 'DESC' order by prepending a hyphen to the sort column
         * name. `orderBy("date", 'DESC')` is the same as `orderBy("-date")`.
         *
         * Unless specified using dot notation (i.e., "table.column"), the default
         * table will be the table name of the model `orderBy` was called on.
         *
         * @example
         *
         * Cars.forge().orderBy('color', 'ASC').fetchAll()
         *    .then(function (rows) { // ...
         *
         * @param sort {string}
         *   Column to sort on
         * @param order {string}
         *   Ascending ('ASC') or descending ('DESC') order
         */
        orderBy (sort, order) {
            const tableName = this.constructor.prototype.tableName;

            const _order = order || (sort.startsWith('-') ? 'DESC' : 'ASC');

            let _sort = sort.startsWith('-') ? sort.slice(1) : sort;

            if (_sort.indexOf('.') === -1) {
                _sort = `${tableName}.${_sort}`;
            }

            return this.query(qb => {
                qb.orderBy(_sort, _order);
            });
        },

        /**
         * @method Model#fetchPage
         * @since 0.9.3
         * @description
         *
         * Similar to {@link Model#fetchAll}, but fetches a single page of results
         * as specified by the limit (page size) and offset or page number.
         *
         * Any options that may be passed to {@link Model#fetchAll} may also be passed
         * in the options to this method.
         *
         * To perform pagination, include a `limit` and _either_ `offset` or `page`.
         * If an invalid limit, offset, or page parameter is passed
         * (i.e., limit < 1, offset < 0, page < 1), an error will be thrown.
         *
         * Below is an example showing the user of a JOIN query with sort/ordering,
         * pagination, and related models.
         *
         * @example
         *
         * Car
         * .query(function (qb) {
         *    qb.innerJoin('manufacturers', 'cars.manufacturer_id', 'manufacturers.id');
         *    qb.groupBy('cars.id');
         *    qb.where('manufacturers.country', '=', 'Sweden');
         * })
         * .orderBy('-productionYear') // Same as .orderBy('cars.productionYear', 'DESC')
         * .fetchPage({
         *    limit: 15, // Defaults to 10 if not specified
         *    page: 3, // Defaults to 1 if not specified; same as {offset: 30} with limit of 15.
         * })
         * .then(function (results) {
         *    console.log(results); // Paginated results object with metadata example below
         * })
         *
         * // Pagination results:
         *
         * {
         *    rows: [<Car>], // the requested page of results
         *    rowCount: 15, // Would be less than 15 on the last page of results
         *    total: 53, // Total number of rows found for the query before pagination
         *    limit: 15, // The requested number of rows per page, same as rowCount except final page
         *    page: 3, // The requested page number
         *    offset: 30 // The requested offset, calculated from the page/limit if not provided
         * }
         *
         * @param options {object}
         *    The pagination options, plus any additional options that will be passed to
         *    {@link Model#fetchAll}
         * @returns {Promise<Collection>}
         */
        fetchPage (options) {
            const {limit, page, offset, ...fetchOptions} = options;

            const _limit = limit ? parseInt(limit) : 10;
            const _page = page ? parseInt(page) : 1;
            const _offset = offset ? parseInt(offset) : _limit * (_page - 1);

            if (_limit < 1) {
                throw new Error(`Requested limit: ${limit}. Limit must be greater than 0.`);
            }

            if (_page < 1) {
                throw new Error(`Requested page: ${page}. Results start at page 1.`);
            }

            if (_offset < 0) {
                throw new Error(`Requested offset: ${offset}. The first row has offset 0.`);
            }

            const tableName = this.constructor.prototype.tableName;
            const idAttribute = this.constructor.prototype.idAttribute ?
                this.constructor.prototype.idAttribute : 'id';

            const paginate = () => {
                // const pageQuery = clone(this.query());
                const pager = this.constructor.forge();

                return pager

                    .query(qb => {
                        Object.assign(qb, this.query().clone());
                        Reflect.apply(qb.limit, qb, [_limit]);
                        Reflect.apply(qb.offset, qb, [_offset]);
                        return null;
                    })

                    .fetchAll(fetchOptions);
            };

            const count = () => {
                const notNeededQueries = [
                    'orderByBasic',
                    'orderByRaw',
                    'groupByBasic',
                    'groupByRaw',
                ];
                const counter = this.constructor.forge();

                return counter

                    .query(qb => {
                        Object.assign(qb, this.query().clone());

                        // Remove grouping and ordering. Ordering is unnecessary
                        // for a count, and grouping returns the entire result set
                        // What we want instead is to use `DISTINCT`
                        Reflect.apply(qb.countDistinct, qb, [`${tableName}.${idAttribute}`]);
                        _remove(qb._statements, statement => notNeededQueries.indexOf(statement.type) > -1);
                    })

                    .fetchAll()

                    .then(result => {
                        const metadata = {page, limit, offset};

                        if (result && result.length == 1) {
                            metadata.total = result.models[0].get('count');
                        }

                        return metadata;
                    });
            };

            return Promise.join(paginate(), count())
                .then(([rows, metadata]) => {
                    return Object.assign({rows}, metadata, {rowCount: rows.length});
                });
        },

    });
}
