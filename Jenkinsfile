
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                bat 'npm install'
                bat 'npm run compile'
            }
        }
    }
}