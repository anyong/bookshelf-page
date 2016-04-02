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
            const idAttribute = this.constructor.prototype.idAttribute ?
                this.constructor.prototype.idAttribute : 'id';

            let _sort;

            if (sort && sort.startsWith('-')) {
                _sort = sort.slice(1);
            } else if (sort) {
                _sort = sort;
            } else {
                _sort = idAttribute;
            }

            const _order = order || (
                (sort && sort.startsWith('-')) ? 'DESC' : 'ASC'
            );

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
         *
         * The defaults are page 1 (offset 0) and limit 10 when no parameters or invalid
         * parameters are passed.
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
         *    withRelated: ['engine'] // Passed to Model#fetchAll
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
         * @returns {Promise<Model|null>}
         */
        fetchPage (options) {
            const {limit, page, offset, ...fetchOptions} = options;

            let _limit = parseInt(limit);
            let _page = parseInt(page);
            let _offset = parseInt(offset);

            if (Number.isNaN(_limit) || !Number.isInteger(_limit) || _limit < 0) {
                _limit = 10;
            }

            if (page && Number.isInteger(_page) && _page > 0) {
                // Request by page number, calculate offset
                _offset = _limit * (_page - 1);
            } else if (offset && Number.isInteger(_offset) && _offset >= 0) {
                // Request by offset, calculate page
                _page = Math.floor(_offset / _limit) + 1;
            } else {
                // Defaults for erroneous or not defined page/offset
                _page = 1;
                _offset = 0;
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
                        const metadata = {page: _page, limit: _limit, offset: _offset};

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
