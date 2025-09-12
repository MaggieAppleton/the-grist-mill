const { db } = require("./connection");

function getAllResearchStatements() {
	return new Promise((resolve, reject) => {
		const query = `
				SELECT id, name, statement, embedding, keywords, negative_keywords, is_active, created_at, updated_at
				FROM research_statements
				ORDER BY created_at DESC
			`;
		db.all(query, [], (err, rows) => {
			if (err) {
				return reject(err);
			}
			resolve(rows || []);
		});
	});
}

function getResearchStatementById(id) {
	return new Promise((resolve, reject) => {
		const query = `
				SELECT id, name, statement, embedding, keywords, negative_keywords, is_active, created_at, updated_at
				FROM research_statements
				WHERE id = ?
			`;
		db.get(query, [Number(id)], (err, row) => {
			if (err) {
				return reject(err);
			}
			resolve(row || null);
		});
	});
}

function createResearchStatement({
	name,
	statement,
	keywords,
	negative_keywords,
	is_active = true,
}) {
	return new Promise((resolve, reject) => {
		const insert = `
				INSERT INTO research_statements (name, statement, keywords, negative_keywords, is_active)
				VALUES (?, ?, ?, ?, ?)
			`;
		db.run(
			insert,
			[
				String(name || "").trim(),
				String(statement || "").trim(),
				typeof keywords === "string" ? keywords : JSON.stringify([]),
				typeof negative_keywords === "string"
					? negative_keywords
					: JSON.stringify([]),
				is_active ? 1 : 0,
			],
			function (err) {
				if (err) {
					return reject(err);
				}
				resolve(this.lastID);
			}
		);
	});
}

function updateResearchStatement(
	id,
	{ name, statement, keywords, negative_keywords, is_active }
) {
	return new Promise((resolve, reject) => {
		const fields = [];
		const params = [];
		if (typeof name === "string") {
			fields.push("name = ?");
			params.push(name.trim());
		}
		if (typeof statement === "string") {
			fields.push("statement = ?");
			params.push(statement.trim());
		}
		if (typeof keywords === "string") {
			fields.push("keywords = ?");
			params.push(keywords);
		}
		if (typeof negative_keywords === "string") {
			fields.push("negative_keywords = ?");
			params.push(negative_keywords);
		}
		if (typeof is_active === "boolean") {
			fields.push("is_active = ?");
			params.push(is_active ? 1 : 0);
		}
		fields.push("updated_at = CURRENT_TIMESTAMP");
		const sql = `UPDATE research_statements SET ${fields.join(
			", "
		)} WHERE id = ?`;
		params.push(Number(id));
		db.run(sql, params, function (err) {
			if (err) {
				return reject(err);
			}
			resolve(this.changes);
		});
	});
}

function deleteResearchStatement(id) {
	return new Promise((resolve, reject) => {
		const sql = `DELETE FROM research_statements WHERE id = ?`;
		db.run(sql, [Number(id)], function (err) {
			if (err) {
				return reject(err);
			}
			resolve(this.changes);
		});
	});
}

function updateResearchStatementEmbedding(id, embeddingVector) {
	return new Promise((resolve, reject) => {
		const sql = `UPDATE research_statements SET embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
		let payload = null;
		try {
			if (Array.isArray(embeddingVector)) {
				payload = JSON.stringify(embeddingVector);
			} else if (embeddingVector == null) {
				payload = null;
			} else if (typeof embeddingVector === "string") {
				payload = embeddingVector;
			} else {
				payload = JSON.stringify(embeddingVector);
			}
		} catch (_) {
			payload = null;
		}
		db.run(sql, [payload, Number(id)], function (err) {
			if (err) {
				return reject(err);
			}
			resolve(this.changes);
		});
	});
}

module.exports = {
	getAllResearchStatements,
	getResearchStatementById,
	createResearchStatement,
	updateResearchStatement,
	deleteResearchStatement,
	updateResearchStatementEmbedding,
};
