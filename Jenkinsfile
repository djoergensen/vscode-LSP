Jenkinsfile (Declarative Pipeline)
pipeline {
    agent { docker { image 'node:6.3' } }
    stages {
        stage('build') {
            steps {
                bat 'npm --version'
            }
        }
    }
}