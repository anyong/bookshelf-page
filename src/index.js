import Promise from 'bluebird';

/**
 * The default pagination options, these can be overridden
 * by the user by passing an options object as the first argument
 * to the Model#pagination call. The 'sort' column here can
 * refer to any column in the Model's table or another table using
 * the standard 'table.column' notation.
 */
const defaultOptions = {
    page: 1,
    limit: 10,
};

/**
 * Exports a plugin to pass into the bookshelf instance, i.e.:
 *
 *      import config from './knexfile';
 *      import knex from 'knex';
 *      import bookshelf from 'bookshelf';
 *      import pagination from 'bookshelf-pagination-plugin';
 *
 *      const ORM = bookshelf(knex(config));
 *
 *      ORM.plugin(pagination);
 *
 *      export default ORM;
 *
 * The plugin attaches one static and one instance method to the bookshelf
 * Model object, both called 'paginate'.
 *
 * Model#paginate takes three parameters:
 *
 *      - an options object as described above
 *      - a query builder object or function, the same as what would be passed
 *        to Model##query
 *      - the fetch options object, same as what gets passed to Model#fetchAll
 *
 * The method returns a promise that resolves with an object containing the
 * found rows and pagination metadata:
 *
 *      {
 *          total: (integer),
 *          page: (integer),
 *          offset: (integer),
 *          rows: (Array[Model])
 *      }
 *
 * This allows for simple creation of paginated complex queries.
 * See the cars-api-example.js gist for an example.
 */
export default function paginate (bookshelf) {
    bookshelf.Model = bookshelf.Model.extend({

        // Need to remove this query from the query builder in 'count' function because GROUP BY is not necessary
        orderBy (sort, order) {
            return this.query(qb => {
                qb.orderBy(sort, order);
            });
        },

        paginate (userOptions) {
            const options = Object.assign({}, defaultOptions, userOptions);
            const {limit, page, ...fetchOptions} = options;
            const offset = limit * (page - 1);

            const tableName = this.constructor.prototype.tableName;
            const idAttribute = this.constructor.prototype.idAttribute ?
                this.constructor.prototype.idAttribute : 'id';

            const fetchPage = () => {
                // const pageQuery = clone(this.query());
                const pager = this.constructor.forge();

                return pager
                    .query(qb => {
                        Object.assign(qb, this.query().clone());
                        Reflect.apply(qb.limit, qb, [limit]);
                        Reflect.apply(qb.offset, qb, [offset]);
                        return null;
                    })

                    .fetchAll(fetchOptions);
            };

            const count = () => {
                const counter = this.constructor.forge();

                return counter
                    .query(qb => {
                        Object.assign(qb, this.query().clone());
                        Reflect.apply(qb.count, qb, [`${tableName}.${idAttribute}`]);
                    })
                    .fetch()
                    .then(result => {
                        return {
                            page, limit, offset,
                            total: result.get('count'),
                        };
                    });
            };

            return Promise.join(fetchPage(), count())
                .then(([rows, meta]) => {
                    return Object.assign({rows}, meta, {rowCount: rows.length});
                });
        },

    });
}
