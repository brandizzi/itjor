var models = require('./models.js');
var downloadToTempFile = require('./downloadToTempFile.js');
var getManifestFromPath = require('./getManifestFromPath');
var getSHA256Hash = require('./getSHA256Hash');
var wdd = require('./weDeployData');

var getPOMObj = (groupId, artifactId, version) => {
    if (groupId && artifactId && version) {
        return new models.POM(groupId, artifactId, version);
    }
};

var sorted = (array) => {
    var copy = array.slice();
    copy.sort();
    return copy;
}

var sortedJarInfo = (jarInfo) => {
    var copy = {};
    Object.assign(copy, jarInfo);

    copy.pom = sorted(copy.pom);
    copy.filenames = sorted(copy.filenames);
    copy.urls = sorted(copy.urls);

    return copy;
};

var equalJarInfo = (ji1, ji2) => {
    return deepEqual(sortedJarInfo(ji1), sortedJarInfo(ji2));
};

var checkJar = (url, groupId, artifactId, version) => {
    return new Promise((resolve, reject) => {
        var pom = getPOMObj(groupId, artifactId, version);
        var jarInfo = new models.JarInfo()

        jarInfo.addURL(url);
        jarInfo.addPOM(pom);

        console.log('checking ' + url);

        downloadToTempFile(url)
        .then(fileInfo => {
            jarInfo.addFilename(fileInfo.filename);

            return getSHA256Hash(fileInfo.path)
            .then(hash => {
                jarInfo.id = hash;

                return wdd.get(hash)
                .then(ji => {
                    jarInfo.merge(ji);

                    if (!jarInfo.equals(ji)) {
                        wdd.update(jarInfo);
                    }
                })
                .catch(err => {
                    return getManifestFromPath(fileInfo.path)
                    .then(contents => {
                        var soughtKey = "\nBundle-SymbolicName:"
                        contents = "\n" + contents;
                        jarInfo.osgiready = contents.includes(soughtKey);

                        wdd.create(jarInfo);
                    });
                })
            });
        })
        .then(() => {
            console.log('checked: ' + url);

            resolve(jarInfo);
        })
        .catch(report => {
            console.warn('failed checking ' + url);

            reject(report);
        });
    });
};

module.exports = checkJar;
