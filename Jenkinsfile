
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                bat 'npm install'
                bat 'npm run compile'
                bat 'node node_modules/vscode/bin/test'
            }
        }
    }
}