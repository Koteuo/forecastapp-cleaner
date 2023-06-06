var fs = require("fs");
var mysql = require('mysql');

// Connect to MySQL server
var con = mysql.createConnection ({
    host: "localhost",
    user: "root",
    password: "",
    database: "wypadki"
});


// List all sessions.
function list_sessions() {
    
    let sessions = [];
    let sessions_files_names = [];
    let files = fs.readdirSync("C:\\xampp\\tmp");
    files.forEach(file => {
        if (file.startsWith("sess_")) {
            sessions.push(file.substring(5));
            sessions_files_names.push(file);
        }
    });

    return [sessions, sessions_files_names];
}

var sessions = list_sessions()[0];
var sessions_files_names = list_sessions()[1];


// Check if there are "db_id" and "db_id_optimization" keys declared in session files.
// List them into array of arrays.
function sessions_files_keys() {
    let sessions_declared_keys = [];
    for (let i = 0; i < sessions_files_names.length; i++) {
        let opened_file = fs.readFileSync("C:\\xampp\\tmp\\" + sessions_files_names[i], { encoding: 'utf8', flag: 'r' });
        let db_id = "";
        let db_id_optimization = "";
        let session_time = "";

        let db_id_index = opened_file.indexOf("db_id|");
        let db_id_optimization_index = opened_file.indexOf("db_id_optimization|");
        let session_time_index = opened_file.indexOf("time|");

        if (db_id_index != -1) {
            db_id = opened_file.substring(db_id_index + 12, db_id_index + 30);
        }
        
        if (db_id_optimization_index != -1) {
            db_id_optimization = opened_file.substring(db_id_optimization_index + 25, db_id_optimization_index + 42);
        }

        if (session_time_index != -1) {
            session_time = opened_file.substring(session_time_index + 7 , session_time_index + 17);
            if (session_time.indexOf("{") != -1) {
                session_time = "";
            }
        }


        sessions_declared_keys[i] = [session_time, db_id, db_id_optimization];
    }
    return sessions_declared_keys;
}

var sessions_declared_keys = sessions_files_keys();

// Determine which sessions are to be terminated and which tables to be dropped.
function session_to_be_terminated() {
    let sessions_to_be_terminated = [];
    let tables_to_be_dropped = [];
    let tables_to_be_preserved = [];
    for (let i = 0; i < sessions_declared_keys.length; i++) {
        if ((Math.abs(sessions_declared_keys[i][0] - Math.floor(Date.now() / 1000)) > 1200) || (sessions_declared_keys[i][0] === "")) {
            sessions_to_be_terminated.push(sessions[i]);
            if(sessions_declared_keys[i][1] != "") {
                tables_to_be_dropped.push(sessions_declared_keys[i][1]);
            }
            if(sessions_declared_keys[i][2] != "") {
                tables_to_be_dropped.push(sessions_declared_keys[i][2]);
            }
        }
        else {
            if(sessions_declared_keys[i][1] != "") {
                tables_to_be_preserved.push(sessions_declared_keys[i][1]);
            }
            if(sessions_declared_keys[i][2] != "") {
                tables_to_be_preserved.push(sessions_declared_keys[i][2]);
            }
        }
    }
    return [sessions_to_be_terminated, tables_to_be_dropped, tables_to_be_preserved]
}

var sessions_to_be_terminated = session_to_be_terminated()[0];
var tables_to_be_dropped = session_to_be_terminated()[1];
var tables_to_be_preserved = session_to_be_terminated()[2];

// Check if the tables even exist.

let check_db = new Promise ((resolve, reject) => {
    con.connect();
    con.query("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = 'wypadki'", function (error, results) {
        if (error) throw error;
        resolve(results);
    });
    
});

check_db.then((tables_in_db) => {
    if (tables_in_db.length > 0) {
        for (let i = 0; i < tables_in_db.length; i++) {
            tables_in_db[i] = String(tables_in_db[i].TABLE_NAME);
        }
    }

    var tables_that_shouldnt_exist = [];

    if (tables_to_be_preserved.length > 0) {
        console.log("tables to be preserved",tables_to_be_preserved);
        tables_that_shouldnt_exist = tables_in_db;
        for (let i = 0; i < tables_to_be_preserved.length; i++) {
            let index = tables_that_shouldnt_exist.indexOf(tables_to_be_preserved[i]);
            tables_that_shouldnt_exist.splice(index, 1);
        }
    }
    else {
        tables_that_shouldnt_exist = tables_in_db;
    }
    console.log("tables that shouldn\'t exist",tables_that_shouldnt_exist);


    for (let i = 0; i < tables_that_shouldnt_exist.length; i++){
        con.query("DROP TABLE "+tables_that_shouldnt_exist[i]+";", function (error, results) {
            if (error) throw error;
            console.log("Dropped table: "+tables_that_shouldnt_exist[i]);
        });
    }
    con.end();
});

for (let i = 0; i < sessions_to_be_terminated.length; i++) {
    try {
        fs.unlinkSync("C:\\xampp\\tmp\\sess_" + sessions_to_be_terminated[i]);
        console.log("Session: " + sessions_to_be_terminated[i] + " is deleted!")
    }
    catch (error) {
        console.error(error);
    }
}